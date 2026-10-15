import { useEffect, useState } from 'react'
import { ChevronRight, Gift, Percent, Tag, Truck } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { csv } from '../lib/csv.js'
import { useJson } from '../lib/api.js'
import { EmptyPane, Status } from './ui.jsx'

const TYPES = [
  { id: 'products', title: 'Amount off products', text: 'Discount specific products or collections of products', kind: 'Amount off products', group: 'Product discount', icon: Tag },
  { id: 'bxgy', title: 'Buy X get Y', text: 'Discount specific products or collections of products', kind: 'Buy X get Y', group: 'Product discount', icon: Gift },
  { id: 'order', title: 'Amount off order', text: 'Discount the total order amount', kind: 'Amount off order', group: 'Order discount', icon: Percent },
  { id: 'shipping', title: 'Free shipping', text: 'Offer free shipping on an order', kind: 'Free shipping', group: 'Shipping discount', icon: Truck },
]

function Scissors() {
  return (
    <svg className="empty-mark" viewBox="0 0 120 100" aria-hidden="true">
      <circle cx="60" cy="50" r="36" fill="#e7f6f4" />
      <rect x="38" y="28" width="36" height="28" rx="4" fill="#e6b15a" />
      <text x="56" y="48" textAnchor="middle" fontSize="16" fill="#fff">%</text>
      <path d="M46 62c8 10 20 10 28 0" stroke="#1f8a8a" strokeWidth="4" fill="none" />
      <circle cx="44" cy="74" r="8" fill="#1f8a8a" />
      <circle cx="76" cy="74" r="8" fill="#1f8a8a" />
    </svg>
  )
}

function typeOf(kind) {
  if (kind === 'Free shipping') return 'shipping'
  if (kind === 'Fixed amount' || kind === 'Amount off order') return 'order'
  if (kind === 'Buy X get Y') return 'bxgy'
  return 'products'
}

function blank(type = 'products') {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const starts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  return {
    type,
    method: 'code',
    code: '',
    title: '',
    valueMode: 'percent',
    percent: '',
    amount: '',
    applies: type === 'products' ? 'Specific collections' : 'Specific products',
    picks: [],
    buyMode: 'qty',
    buyQty: '1',
    buyAmount: '',
    buyFrom: 'Specific products',
    buyPicks: [],
    getQty: '1',
    getFrom: 'Specific products',
    getPicks: [],
    getMode: 'percent',
    getValue: '',
    maxPerOrder: false,
    maxPerOrderQty: '',
    eligibility: 'All customers',
    segments: [],
    minimum: 'none',
    minimumAmount: '',
    minimumQty: '',
    limitTotal: false,
    usageLimit: '',
    once: false,
    combines: false,
    starts,
    ends: '',
    showEnd: false,
    countries: 'all',
    countryList: ['Kenya'],
    excludeRates: false,
    excludeAmount: '',
    featured: false,
    tags: '',
  }
}

function parseConfig(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function formFromRow(row) {
  const config = parseConfig(row.config)
  if (config.type) return { ...blank(config.type), ...config, id: row.id }
  const type = typeOf(row.kind)
  const form = blank(type)
  form.id = row.id
  form.code = row.code
  if (String(row.value).includes('%')) {
    form.valueMode = 'percent'
    form.percent = String(row.value).replace('%', '').trim()
  } else if (type !== 'shipping') {
    form.valueMode = 'amount'
    form.amount = String(row.value).replace(/[^\d.]/g, '')
  }
  return form
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join('')
}

function displayValue(form) {
  const meta = TYPES.find(item => item.id === form.type)
  if (form.type === 'shipping') return 'Free shipping'
  if (form.type === 'bxgy') {
    const off = form.getMode === 'free' ? 'free' : form.getMode === 'amount' ? `KES ${form.getValue || 0} off` : `${form.getValue || 0}% off`
    return `Buy ${form.buyQty || 1} get ${form.getQty || 1} ${off}`
  }
  if (form.valueMode === 'amount') return form.amount ? `KES ${form.amount}` : ''
  return form.percent ? `${form.percent}%` : ''
}

function whenLabel(value) {
  if (!value) return 'today'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'today'
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'today'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function details(form) {
  const lines = [form.eligibility === 'All customers' ? 'All customers' : (form.segments.join(', ') || 'Specific customer segments')]
  lines.push('For Online Store')
  if (form.type === 'shipping') lines.push(form.countries === 'all' ? 'For all countries' : (form.countryList.join(', ') || 'Selected countries'))
  if (form.minimum === 'none') lines.push('No minimum purchase requirement')
  else if (form.minimum === 'amount') lines.push(`Minimum purchase of KES ${form.minimumAmount || 0}`)
  else lines.push(`Minimum quantity of ${form.minimumQty || 0}`)
  if (!form.limitTotal && !form.once) lines.push('No usage limits')
  if (form.limitTotal) lines.push(`Limited to ${form.usageLimit || 0} uses`)
  if (form.once) lines.push('One use per customer')
  lines.push(form.combines ? 'Can combine with other discounts' : "Can't combine with other discounts")
  lines.push(`Active from ${whenLabel(form.starts)}`)
  return lines
}

function ItemSearch({ placeholder, items, selected, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const hits = items.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()) && !selected.includes(name)).slice(0, 6)
  return (
    <div className="discount-search">
      <input
        placeholder={placeholder}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim() && (
        <div className="picker">
          {hits.length === 0 && <p className="muted">No matches</p>}
          {hits.map(name => (
            <button type="button" key={name} onClick={() => { onChange([...selected, name]); setQuery(''); setOpen(false) }}>{name}</button>
          ))}
        </div>
      )}
      {selected.length > 0 && <p className="chip-row">{selected.map(name => <button type="button" className="quiet-tag" key={name} onClick={() => onChange(selected.filter(item => item !== name))}>{name}</button>)}</p>}
    </div>
  )
}

function Browse({ title, items, selected, onChange, onClose }) {
  const [query, setQuery] = useState('')
  const shown = items.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = name => onChange(selected.includes(name) ? selected.filter(item => item !== name) : [...selected, name])
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-form">
        <input aria-label={`Search ${title}`} placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="browse-list">
          {shown.map(name => (
            <label key={name} className="choice"><input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />{name}</label>
          ))}
          {shown.length === 0 && <p className="muted">Nothing matches that search.</p>}
        </div>
      </div>
      <div className="modal-actions"><button type="button" className="solid" onClick={onClose}>Done</button></div>
    </Modal>
  )
}

function DiscountEditor({ type, discountId, onOpen, onSaved }) {
  const [products] = useJson('/api/products')
  const [collections] = useJson('/api/collections')
  const [segments] = useJson('/api/segments')
  const [form, setForm] = useState(() => blank(type || 'products'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [browse, setBrowse] = useState('')
  const [tagsOpen, setTagsOpen] = useState(false)
  const patch = next => setForm(current => ({ ...current, ...next }))
  useEffect(() => {
    if (!discountId) return
    fetch(`/api/discounts/${discountId}`).then(r => r.json()).then(row => {
      if (row.error) setError(row.error)
      else setForm(formFromRow(row))
    }).catch(() => setError('Could not load this discount.'))
  }, [discountId])
  const meta = TYPES.find(item => item.id === form.type) || TYPES[0]
  const productNames = (products || []).map(row => row.title)
  const collectionNames = (collections || []).map(row => row.title)
  const segmentNames = (segments || []).map(row => row.name)
  const catalog = form.applies === 'Specific collections' ? collectionNames : productNames
  const save = event => {
    event.preventDefault()
    const value = displayValue(form)
    if (form.type !== 'shipping' && form.type !== 'bxgy' && !value) { setError('Enter a discount value.'); return }
    if (form.type === 'bxgy' && form.getMode !== 'free' && !form.getValue) { setError('Enter the discounted value.'); return }
    setBusy(true)
    const body = {
      method: form.method,
      code: form.code,
      title: form.title,
      kind: meta.kind,
      value: value || 'Free shipping',
      config: { ...form, id: undefined },
    }
    const request = form.id
      ? fetch(`/api/discounts/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : fetch('/api/discounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    request.then(async response => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save this discount')
      onSaved()
      onOpen('discounts', { discount: payload.id })
    }).catch(err => setError(err.message)).finally(() => setBusy(false))
  }
  const codeLabel = form.method === 'code' ? (form.code || 'No discount code yet') : (form.title || 'No title yet')
  return (
    <form className="order-page" onSubmit={save}>
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('discounts')}>Discounts</button>
        <span>/</span><span>{form.id ? form.code || meta.title : 'Create discount'}</span>
      </div>
      <div className="product-head">
        <h1>{form.id ? meta.title : 'Create discount'}</h1>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid">
        <div>
          <section className="detail-card">
            <h2>{meta.title}</h2>
            <p className="side-label">Method</p>
            <div className="method-toggle" role="group" aria-label="Discount method">
              <button type="button" className={form.method === 'code' ? 'on' : ''} onClick={() => patch({ method: 'code' })}>Discount code</button>
              <button type="button" className={form.method === 'automatic' ? 'on' : ''} onClick={() => patch({ method: 'automatic' })}>Automatic discount</button>
            </div>
            {form.method === 'code' ? (
              <label>Discount code
                <span className="code-row">
                  <input value={form.code} onChange={e => patch({ code: e.target.value.toUpperCase() })} />
                  <button type="button" className="text-link" onClick={() => patch({ code: randomCode() })}>Generate random code</button>
                </span>
              </label>
            ) : (
              <label>Title<input value={form.title} onChange={e => patch({ title: e.target.value })} /></label>
            )}
            <p className="muted">{form.method === 'code' ? 'Customers must enter this code at checkout.' : 'Customers will see this title in their cart and at checkout.'}</p>
          </section>

          {form.type === 'bxgy' ? (
            <>
              <section className="detail-card">
                <h2>Customer buys</h2>
                <label className="choice"><input type="radio" checked={form.buyMode === 'qty'} onChange={() => patch({ buyMode: 'qty' })} />Minimum quantity of items</label>
                <label className="choice"><input type="radio" checked={form.buyMode === 'amount'} onChange={() => patch({ buyMode: 'amount' })} />Minimum purchase amount</label>
                <div className="split">
                  <label>{form.buyMode === 'qty' ? 'Quantity' : 'Amount (KES)'}
                    <input inputMode="decimal" value={form.buyMode === 'qty' ? form.buyQty : form.buyAmount} onChange={e => patch(form.buyMode === 'qty' ? { buyQty: e.target.value.replace(/[^\d]/g, '') } : { buyAmount: e.target.value.replace(/[^\d.]/g, '') })} />
                  </label>
                  <label>Any items from
                    <select value={form.buyFrom} onChange={e => patch({ buyFrom: e.target.value, buyPicks: [] })}>
                      <option>Specific products</option>
                      <option>Specific collections</option>
                    </select>
                  </label>
                </div>
                <div className="browse-row">
                  <ItemSearch placeholder={form.buyFrom === 'Specific collections' ? 'Search collections' : 'Search products'} items={form.buyFrom === 'Specific collections' ? collectionNames : productNames} selected={form.buyPicks} onChange={buyPicks => patch({ buyPicks })} />
                  <button type="button" className="ghost" onClick={() => setBrowse('buy')}>Browse</button>
                </div>
              </section>
              <section className="detail-card">
                <h2>Customer gets</h2>
                <p className="muted">Customers must add the quantity of items specified below to their cart.</p>
                <div className="split">
                  <label>Quantity<input inputMode="numeric" value={form.getQty} onChange={e => patch({ getQty: e.target.value.replace(/[^\d]/g, '') })} /></label>
                  <label>Any items from
                    <select value={form.getFrom} onChange={e => patch({ getFrom: e.target.value, getPicks: [] })}>
                      <option>Specific products</option>
                      <option>Specific collections</option>
                    </select>
                  </label>
                </div>
                <div className="browse-row">
                  <ItemSearch placeholder={form.getFrom === 'Specific collections' ? 'Search collections' : 'Search products'} items={form.getFrom === 'Specific collections' ? collectionNames : productNames} selected={form.getPicks} onChange={getPicks => patch({ getPicks })} />
                  <button type="button" className="ghost" onClick={() => setBrowse('get')}>Browse</button>
                </div>
                <p className="side-label">At a discounted value</p>
                <label className="choice"><input type="radio" checked={form.getMode === 'percent'} onChange={() => patch({ getMode: 'percent' })} />Percentage</label>
                {form.getMode === 'percent' && <span className="suffix-field"><input inputMode="decimal" aria-label="Percentage off" value={form.getValue} onChange={e => patch({ getValue: e.target.value.replace(/[^\d.]/g, '') })} /><span>%</span></span>}
                <label className="choice"><input type="radio" checked={form.getMode === 'amount'} onChange={() => patch({ getMode: 'amount' })} />Amount off each</label>
                {form.getMode === 'amount' && <span className="suffix-field"><input inputMode="decimal" aria-label="Amount off each" value={form.getValue} onChange={e => patch({ getValue: e.target.value.replace(/[^\d.]/g, '') })} /><span>KES</span></span>}
                <label className="choice"><input type="radio" checked={form.getMode === 'free'} onChange={() => patch({ getMode: 'free', getValue: '' })} />Free</label>
                <label className="choice"><input type="checkbox" checked={form.maxPerOrder} onChange={e => patch({ maxPerOrder: e.target.checked })} />Set a maximum number of uses per order</label>
                {form.maxPerOrder && <input aria-label="Maximum uses per order" inputMode="numeric" value={form.maxPerOrderQty} onChange={e => patch({ maxPerOrderQty: e.target.value.replace(/[^\d]/g, '') })} />}
              </section>
            </>
          ) : form.type === 'shipping' ? (
            <section className="detail-card">
              <h2>Countries</h2>
              <label className="choice"><input type="radio" checked={form.countries === 'all'} onChange={() => patch({ countries: 'all' })} />All countries</label>
              <label className="choice"><input type="radio" checked={form.countries === 'selected'} onChange={() => patch({ countries: 'selected' })} />Selected countries</label>
              {form.countries === 'selected' && (
                <div className="chip-row">
                  {['Kenya', 'Uganda', 'Tanzania'].map(country => (
                    <label key={country} className="choice"><input type="checkbox" checked={form.countryList.includes(country)} onChange={() => patch({ countryList: form.countryList.includes(country) ? form.countryList.filter(item => item !== country) : [...form.countryList, country] })} />{country}</label>
                  ))}
                </div>
              )}
              <p className="side-label">Shipping rates</p>
              <label className="choice"><input type="checkbox" checked={form.excludeRates} onChange={e => patch({ excludeRates: e.target.checked })} />Exclude shipping rates over a certain amount</label>
              {form.excludeRates && <span className="suffix-field"><input aria-label="Maximum shipping rate" inputMode="decimal" value={form.excludeAmount} onChange={e => patch({ excludeAmount: e.target.value.replace(/[^\d.]/g, '') })} /><span>KES</span></span>}
            </section>
          ) : (
            <section className="detail-card">
              <h2>Discount value</h2>
              <div className="split">
                <select aria-label="Value type" value={form.valueMode} onChange={e => patch({ valueMode: e.target.value })}>
                  <option value="percent">Percentage</option>
                  <option value="amount">Fixed amount</option>
                </select>
                <span className="suffix-field">
                  <input inputMode="decimal" aria-label="Discount value" value={form.valueMode === 'percent' ? form.percent : form.amount} onChange={e => patch(form.valueMode === 'percent' ? { percent: e.target.value.replace(/[^\d.]/g, '') } : { amount: e.target.value.replace(/[^\d.]/g, '') })} />
                  <span>{form.valueMode === 'percent' ? '%' : 'KES'}</span>
                </span>
              </div>
              {form.type === 'products' && (
                <>
                  <label>Applies to
                    <select value={form.applies} onChange={e => patch({ applies: e.target.value, picks: [] })}>
                      <option>All products</option>
                      <option>Specific collections</option>
                      <option>Specific products</option>
                    </select>
                  </label>
                  {form.applies !== 'All products' && (
                    <div className="browse-row">
                      <ItemSearch placeholder={form.applies === 'Specific collections' ? 'Search collections' : 'Search products'} items={catalog} selected={form.picks} onChange={picks => patch({ picks })} />
                      <button type="button" className="ghost" onClick={() => setBrowse('applies')}>Browse</button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <section className="detail-card">
            <h2>Eligibility</h2>
            <select aria-label="Eligibility" value={form.eligibility} onChange={e => patch({ eligibility: e.target.value, segments: [] })}>
              <option>All customers</option>
              <option>Specific customer segments</option>
            </select>
            {form.eligibility !== 'All customers' && (
              <ItemSearch placeholder="Search segments" items={segmentNames} selected={form.segments} onChange={segments => patch({ segments })} />
            )}
          </section>

          <section className="detail-card">
            <h2>Minimum purchase requirements</h2>
            <label className="choice"><input type="radio" name="minimum" checked={form.minimum === 'none'} onChange={() => patch({ minimum: 'none' })} />No minimum requirements</label>
            <label className="choice"><input type="radio" name="minimum" checked={form.minimum === 'amount'} onChange={() => patch({ minimum: 'amount' })} />Minimum purchase amount (KES)</label>
            {form.minimum === 'amount' && <input aria-label="Minimum purchase amount" inputMode="decimal" value={form.minimumAmount} onChange={e => patch({ minimumAmount: e.target.value.replace(/[^\d.]/g, '') })} />}
            <label className="choice"><input type="radio" name="minimum" checked={form.minimum === 'qty'} onChange={() => patch({ minimum: 'qty' })} />Minimum quantity of items</label>
            {form.minimum === 'qty' && <input aria-label="Minimum quantity" inputMode="numeric" value={form.minimumQty} onChange={e => patch({ minimumQty: e.target.value.replace(/[^\d]/g, '') })} />}
          </section>

          <section className="detail-card">
            <h2>Maximum discount uses</h2>
            <label className="choice"><input type="checkbox" checked={form.limitTotal} onChange={e => patch({ limitTotal: e.target.checked })} />Limit number of times this discount can be used in total</label>
            {form.limitTotal && <input aria-label="Total uses" inputMode="numeric" value={form.usageLimit} onChange={e => patch({ usageLimit: e.target.value.replace(/[^\d]/g, '') })} />}
            <label className="choice"><input type="checkbox" checked={form.once} onChange={e => patch({ once: e.target.checked })} />Limit to one use per customer</label>
          </section>

          <section className="detail-card">
            <div className="between"><h2>Combinations</h2></div>
            <button type="button" className="combo" onClick={() => patch({ combines: !form.combines })}>
              {form.combines
                ? 'This discount can combine with other product, order, and shipping discounts in the customer’s cart.'
                : 'This discount won’t combine with other product, order, or shipping discounts in the customer’s cart.'}
            </button>
          </section>

          <section className="detail-card">
            <h2>Schedule</h2>
            <div className="schedule">
              <input type="datetime-local" aria-label="Start date" value={form.starts} onChange={e => patch({ starts: e.target.value })} />
              <span className="quiet-tag">GMT+3</span>
              {!form.showEnd && <button type="button" className="text-link" onClick={() => patch({ showEnd: true })}>+ Set end date</button>}
            </div>
            {form.showEnd && <input type="datetime-local" aria-label="End date" value={form.ends} onChange={e => patch({ ends: e.target.value })} />}
          </section>
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <p className="muted">Code</p>
            <strong>{codeLabel}</strong>
            <p className="side-label">Type</p>
            <p>{meta.title}</p>
            <p className="muted">{meta.group}</p>
            <p className="side-label">Details</p>
            <ul className="detail-list">{details(form).map(line => <li key={line}>{line}</li>)}</ul>
          </section>
          <section className="detail-card">
            <h2>Sales channel access</h2>
            <label className="choice"><input type="checkbox" checked={form.featured} onChange={e => patch({ featured: e.target.checked })} />Allow discount to be featured on selected channels</label>
          </section>
          <section className="detail-card">
            <h2>Tags</h2>
            {tagsOpen ? <input aria-label="Tags" value={form.tags} onChange={e => patch({ tags: e.target.value })} placeholder="summer, launch" /> : <button type="button" className="ghost" onClick={() => setTagsOpen(true)}>Add tags</button>}
          </section>
        </aside>
      </div>
      {browse === 'applies' && <Browse title={form.applies} items={catalog} selected={form.picks} onChange={picks => patch({ picks })} onClose={() => setBrowse('')} />}
      {browse === 'buy' && <Browse title={form.buyFrom} items={form.buyFrom === 'Specific collections' ? collectionNames : productNames} selected={form.buyPicks} onChange={buyPicks => patch({ buyPicks })} onClose={() => setBrowse('')} />}
      {browse === 'get' && <Browse title={form.getFrom} items={form.getFrom === 'Specific collections' ? collectionNames : productNames} selected={form.getPicks} onChange={getPicks => patch({ getPicks })} onClose={() => setBrowse('')} />}
    </form>
  )
}

export function Discounts({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/discounts')
  const [picking, setPicking] = useState(false)
  const [learn, setLearn] = useState(false)
  if (focus.create === '1') return <DiscountEditor key={focus.type || 'products'} type={focus.type || 'products'} onOpen={onOpen} onSaved={reload} />
  if (focus.discount) return <DiscountEditor key={focus.discount} discountId={focus.discount} onOpen={onOpen} onSaved={reload} />
  const actions = (
    <>
      <button type="button" className="ghost" onClick={() => csv([['Code', 'Type', 'Value', 'Status', 'Uses'], ...(rows || []).map(row => [row.code, row.kind, row.value, row.status, row.uses])], 'discounts.csv')}>Export</button>
      <button type="button" className="solid" onClick={() => setPicking(true)}>Create discount</button>
    </>
  )
  if (!rows) return <p className="muted">Loading discounts…</p>
  return (
    <>
      {rows.length === 0 ? (
        <EmptyPane
          title="Discounts"
          actions={actions}
          heading="Manage discounts and promotions"
          text="Add discount codes and automatic discounts that apply at checkout. You can also use discounts with compare at prices."
          action="Create discount"
          onAction={() => setPicking(true)}
          learn="Learn more about discounts"
          href="https://help.shopify.com/en/manual/discounts"
          mark={<Scissors />}
        />
      ) : (
        <>
          <div className="orders-top">
            <h1>Discounts</h1>
            <div className="orders-actions">{actions}</div>
          </div>
          <div className="sheet">
            <table>
              <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Uses</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="clickable" onClick={() => onOpen('discounts', { discount: row.id })}>
                    <td><button type="button" className="text-link" onClick={() => onOpen('discounts', { discount: row.id })}>{row.code}</button></td>
                    <td>{row.kind}</td>
                    <td>{row.value}</td>
                    <td><Status value={row.status} /></td>
                    <td>{row.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="learn" onClick={() => setLearn(open => !open)}>Learn more about discounts</button>
          {learn && <p className="muted">A code is entered at checkout. An automatic discount applies when the cart matches the products, amount, or shipping rule you set.</p>}
        </>
      )}
      {picking && (
        <Modal title="Select discount type" onClose={() => setPicking(false)}>
          <div className="type-list">
            {TYPES.map(item => (
              <button type="button" key={item.id} className="type-choice" onClick={() => { setPicking(false); onOpen('discounts', { create: '1', type: item.id }) }}>
                <item.icon size={16} />
                <span><strong>{item.title}</strong><small>{item.text}</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <div className="modal-actions"><button type="button" className="ghost" onClick={() => setPicking(false)}>Cancel</button></div>
        </Modal>
      )}
    </>
  )
}
