import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Gift, Image, Percent, Search, Tag, Truck } from 'lucide-react'
import { discounts } from '../api/resources.js'
import { Modal } from '../components/Modal.jsx'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'
import { useJson } from '../lib/api.js'
import { blankDiscount } from '../models/discount.js'
import { discountDetails, discountError, discountFromRow, discountPayload, pickName } from '../serializers/discount.js'
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

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join('')
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

function DiscountProducts({ inventory, selected, onChange, onClose }) {
  const [query, setQuery] = useState('')
  const [searchBy, setSearchBy] = useState('All')
  const [picked, setPicked] = useState([])
  const chosen = new Set(selected.map(item => item.id).filter(Boolean))
  const room = Math.max(0, 100 - selected.length)
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = (inventory || []).filter(item => !chosen.has(item.id))
    const names = [...new Set(rows.map(item => item.product))]
    return names.map(product => {
      const items = rows.filter(item => item.product === product)
      const nameHit = (searchBy === 'All' || searchBy === 'Product') && product.toLowerCase().includes(q)
      const variants = items.filter(item => {
        if (!q || (nameHit && searchBy !== 'Variant' && searchBy !== 'SKU')) return true
        const variant = (item.variant || '').toLowerCase()
        const sku = (item.sku || '').toLowerCase()
        if (searchBy === 'Product') return product.toLowerCase().includes(q)
        if (searchBy === 'Variant') return variant.includes(q)
        if (searchBy === 'SKU') return sku.includes(q)
        return `${product} ${variant} ${sku}`.toLowerCase().includes(q)
      })
      return { product, variants }
    }).filter(group => group.variants.length)
  }, [inventory, selected, query, searchBy])
  const toggle = id => setPicked(current => {
    if (current.includes(id)) return current.filter(item => item !== id)
    if (current.length >= room) return current
    return [...current, id]
  })
  const toggleGroup = variants => {
    const ids = variants.map(item => item.id)
    const all = ids.every(id => picked.includes(id))
    setPicked(current => {
      if (all) return current.filter(id => !ids.includes(id))
      const next = [...current]
      for (const id of ids) {
        if (next.includes(id)) continue
        if (next.length >= room) break
        next.push(id)
      }
      return next
    })
  }
  const addChosen = () => {
    const items = (inventory || []).filter(item => picked.includes(item.id)).map(item => ({ id: item.id, product: item.product, variant: item.variant }))
    if (items.length) onChange([...selected, ...items])
    onClose()
  }
  return (
    <Modal title="Add products" onClose={onClose}>
      <div className="add-products">
        <div className="add-tools">
          <label className="category-search">
            <Search size={14} />
            <input aria-label="Search products" placeholder="Search products" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
          <select aria-label="Search by" value={searchBy} onChange={e => setSearchBy(e.target.value)}>
            <option value="All">Search by All</option>
            <option value="Product">Product</option>
            <option value="Variant">Variant</option>
            <option value="SKU">SKU</option>
          </select>
        </div>
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr><th /><th>Product</th><th>Available</th><th>Price</th></tr>
            </thead>
            <tbody>
              {groups.map(group => {
                const ids = group.variants.map(item => item.id)
                const all = ids.every(id => picked.includes(id))
                const some = ids.some(id => picked.includes(id))
                return (
                  <Fragment key={group.product}>
                    <tr>
                      <td><input aria-label={`Select ${group.product}`} type="checkbox" checked={all} ref={el => { if (el) el.indeterminate = some && !all }} onChange={() => toggleGroup(group.variants)} /></td>
                      <td><span className="inv-name"><Image size={16} /> {group.product}</span></td>
                      <td /><td />
                    </tr>
                    {group.variants.map(item => (
                      <tr key={item.id}>
                        <td><input aria-label={`Select ${item.product} ${item.variant}`} type="checkbox" checked={picked.includes(item.id)} onChange={() => toggle(item.id)} /></td>
                        <td className="inv-variant">{item.variant}</td>
                        <td>{item.available}</td>
                        <td>{money(item.price || 0)}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {inventory && groups.length === 0 && <p className="muted">No inventory matches.</p>}
          {!inventory && <p className="muted">Loading inventory…</p>}
        </div>
      </div>
      <div className="modal-actions">
        <span className="muted">{selected.length + picked.length}/100 products selected</span>
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="solid" disabled={!picked.length} onClick={addChosen}>Add</button>
      </div>
    </Modal>
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

function ProductField({ picks, onBrowse, onChange }) {
  const names = [...new Set(picks.map(pickName))]
  return (
    <div className="discount-products">
      <button type="button" className="po-open" onClick={onBrowse}><Search size={15} /> Search products</button>
      {names.length > 0 && (
        <p className="chip-row">
          {names.map(name => {
            const count = picks.filter(item => pickName(item) === name).length
            const label = count > 1 ? `${name} (${count} variants)` : name
            return <button type="button" className="quiet-tag" key={name} onClick={() => onChange(picks.filter(item => pickName(item) !== name))}>{label}</button>
          })}
        </p>
      )}
    </div>
  )
}

function DiscountEditor({ type, discountId, onOpen, onSaved }) {
  const [collections] = useJson('/api/collections')
  const [segments] = useJson('/api/segments')
  const [inventory] = useJson('/api/inventory')
  const [form, setForm] = useState(() => blankDiscount(type || 'products'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [browse, setBrowse] = useState('')
  const [tagsOpen, setTagsOpen] = useState(false)
  const patch = next => setForm(current => ({ ...current, ...next }))
  useEffect(() => {
    if (!discountId) return
    discounts.read(discountId).then(row => setForm(discountFromRow(row))).catch(err => setError(err.message || 'Could not load this discount.'))
  }, [discountId])
  const meta = TYPES.find(item => item.id === form.type) || TYPES[0]
  const collectionNames = (collections || []).map(row => row.title)
  const segmentNames = (segments || []).map(row => row.name)
  const save = event => {
    event.preventDefault()
    const missing = discountError(form)
    if (missing) { setError(missing); return }
    setBusy(true)
    const body = discountPayload(form, meta.kind)
    const saveDiscount = form.id ? discounts.patch(form.id, body) : discounts.create(body)
    saveDiscount.then(payload => {
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
                  <input required aria-label="Discount code" value={form.code} onChange={e => patch({ code: e.target.value.toUpperCase() })} />
                  <button type="button" className="text-link" onClick={() => patch({ code: randomCode() })}>Generate random code</button>
                </span>
              </label>
            ) : (
              <label>Title<input required aria-label="Title" value={form.title} onChange={e => patch({ title: e.target.value })} /></label>
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
                    <input required inputMode="decimal" aria-label={form.buyMode === 'qty' ? 'Quantity' : 'Amount'} value={form.buyMode === 'qty' ? form.buyQty : form.buyAmount} onChange={e => patch(form.buyMode === 'qty' ? { buyQty: e.target.value.replace(/[^\d]/g, '') } : { buyAmount: e.target.value.replace(/[^\d.]/g, '') })} />
                  </label>
                  <label>Any items from
                    <select value={form.buyFrom} onChange={e => patch({ buyFrom: e.target.value, buyPicks: [] })}>
                      <option>Specific products</option>
                      <option>Specific collections</option>
                    </select>
                  </label>
                </div>
                {form.buyFrom === 'Specific collections' ? (
                  <div className="browse-row">
                    <ItemSearch placeholder="Search collections" items={collectionNames} selected={form.buyPicks} onChange={buyPicks => patch({ buyPicks })} />
                    <button type="button" className="ghost" onClick={() => setBrowse('buy')}>Browse</button>
                  </div>
                ) : (
                  <ProductField picks={form.buyPicks} onBrowse={() => setBrowse('buy')} onChange={buyPicks => patch({ buyPicks })} />
                )}
              </section>
              <section className="detail-card">
                <h2>Customer gets</h2>
                <p className="muted">Customers must add the quantity of items specified below to their cart.</p>
                <div className="split">
                  <label>Quantity<input required inputMode="numeric" aria-label="Quantity the customer gets" value={form.getQty} onChange={e => patch({ getQty: e.target.value.replace(/[^\d]/g, '') })} /></label>
                  <label>Any items from
                    <select value={form.getFrom} onChange={e => patch({ getFrom: e.target.value, getPicks: [] })}>
                      <option>Specific products</option>
                      <option>Specific collections</option>
                    </select>
                  </label>
                </div>
                {form.getFrom === 'Specific collections' ? (
                  <div className="browse-row">
                    <ItemSearch placeholder="Search collections" items={collectionNames} selected={form.getPicks} onChange={getPicks => patch({ getPicks })} />
                    <button type="button" className="ghost" onClick={() => setBrowse('get')}>Browse</button>
                  </div>
                ) : (
                  <ProductField picks={form.getPicks} onBrowse={() => setBrowse('get')} onChange={getPicks => patch({ getPicks })} />
                )}
                <p className="side-label">At a discounted value</p>
                <label className="choice"><input type="radio" checked={form.getMode === 'percent'} onChange={() => patch({ getMode: 'percent' })} />Percentage</label>
                {form.getMode === 'percent' && <span className="suffix-field"><input required inputMode="decimal" aria-label="Percentage off" value={form.getValue} onChange={e => patch({ getValue: e.target.value.replace(/[^\d.]/g, '') })} /><span>%</span></span>}
                <label className="choice"><input type="radio" checked={form.getMode === 'amount'} onChange={() => patch({ getMode: 'amount' })} />Amount off each</label>
                {form.getMode === 'amount' && <span className="suffix-field"><input required inputMode="decimal" aria-label="Amount off each" value={form.getValue} onChange={e => patch({ getValue: e.target.value.replace(/[^\d.]/g, '') })} /><span>KES</span></span>}
                <label className="choice"><input type="radio" checked={form.getMode === 'free'} onChange={() => patch({ getMode: 'free', getValue: '' })} />Free</label>
                <label className="choice"><input type="checkbox" checked={form.maxPerOrder} onChange={e => patch({ maxPerOrder: e.target.checked })} />Set a maximum number of uses per order</label>
                {form.maxPerOrder && <input required aria-label="Maximum uses per order" inputMode="numeric" value={form.maxPerOrderQty} onChange={e => patch({ maxPerOrderQty: e.target.value.replace(/[^\d]/g, '') })} />}
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
              {form.excludeRates && <span className="suffix-field"><input required aria-label="Maximum shipping rate" inputMode="decimal" value={form.excludeAmount} onChange={e => patch({ excludeAmount: e.target.value.replace(/[^\d.]/g, '') })} /><span>KES</span></span>}
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
                  <input required inputMode="decimal" aria-label="Discount value" value={form.valueMode === 'percent' ? form.percent : form.amount} onChange={e => patch(form.valueMode === 'percent' ? { percent: e.target.value.replace(/[^\d.]/g, '') } : { amount: e.target.value.replace(/[^\d.]/g, '') })} />
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
                  {form.applies === 'Specific products' && (
                    <ProductField picks={form.picks} onBrowse={() => setBrowse('applies')} onChange={picks => patch({ picks })} />
                  )}
                  {form.applies === 'Specific collections' && (
                    <div className="browse-row">
                      <ItemSearch placeholder="Search collections" items={collectionNames} selected={form.picks} onChange={picks => patch({ picks })} />
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
            {form.minimum === 'amount' && <input required aria-label="Minimum purchase amount" inputMode="decimal" value={form.minimumAmount} onChange={e => patch({ minimumAmount: e.target.value.replace(/[^\d.]/g, '') })} />}
            <label className="choice"><input type="radio" name="minimum" checked={form.minimum === 'qty'} onChange={() => patch({ minimum: 'qty' })} />Minimum quantity of items</label>
            {form.minimum === 'qty' && <input required aria-label="Minimum quantity" inputMode="numeric" value={form.minimumQty} onChange={e => patch({ minimumQty: e.target.value.replace(/[^\d]/g, '') })} />}
          </section>

          <section className="detail-card">
            <h2>Maximum discount uses</h2>
            <label className="choice"><input type="checkbox" checked={form.limitTotal} onChange={e => patch({ limitTotal: e.target.checked })} />Limit number of times this discount can be used in total</label>
            {form.limitTotal && <input required aria-label="Total uses" inputMode="numeric" value={form.usageLimit} onChange={e => patch({ usageLimit: e.target.value.replace(/[^\d]/g, '') })} />}
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
              <input required type="datetime-local" aria-label="Start date" value={form.starts} onChange={e => patch({ starts: e.target.value })} />
              <span className="quiet-tag">GMT+3</span>
              {!form.showEnd && <button type="button" className="text-link" onClick={() => patch({ showEnd: true })}>+ Set end date</button>}
            </div>
            {form.showEnd && <input required type="datetime-local" aria-label="End date" value={form.ends} onChange={e => patch({ ends: e.target.value })} />}
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
            <ul className="detail-list">{discountDetails(form).map(line => <li key={line}>{line}</li>)}</ul>
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
      {browse === 'applies' && form.applies === 'Specific products' && <DiscountProducts inventory={inventory} selected={form.picks.filter(item => item && item.id)} onChange={picks => patch({ picks })} onClose={() => setBrowse('')} />}
      {browse === 'applies' && form.applies === 'Specific collections' && <Browse title="Specific collections" items={collectionNames} selected={form.picks} onChange={picks => patch({ picks })} onClose={() => setBrowse('')} />}
      {browse === 'buy' && form.buyFrom === 'Specific products' && <DiscountProducts inventory={inventory} selected={form.buyPicks.filter(item => item && item.id)} onChange={buyPicks => patch({ buyPicks })} onClose={() => setBrowse('')} />}
      {browse === 'buy' && form.buyFrom !== 'Specific products' && <Browse title="Specific collections" items={collectionNames} selected={form.buyPicks} onChange={buyPicks => patch({ buyPicks })} onClose={() => setBrowse('')} />}
      {browse === 'get' && form.getFrom === 'Specific products' && <DiscountProducts inventory={inventory} selected={form.getPicks.filter(item => item && item.id)} onChange={getPicks => patch({ getPicks })} onClose={() => setBrowse('')} />}
      {browse === 'get' && form.getFrom !== 'Specific products' && <Browse title="Specific collections" items={collectionNames} selected={form.getPicks} onChange={getPicks => patch({ getPicks })} onClose={() => setBrowse('')} />}
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
