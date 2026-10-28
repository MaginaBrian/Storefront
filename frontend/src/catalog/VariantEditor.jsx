import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Copy, Eye, Image, Plus, Search, Trash2 } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { money } from '../lib/money.js'

const LOCATIONS = ['Nairobi', 'Kisumu', 'Mombasa']

export default function VariantEditor({ item, rows, onOpen, onChanged }) {
  const [menu, setMenu] = useState(false)
  const [preview, setPreview] = useState(false)
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState(false)
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState(false)
  const [skuOpen, setSkuOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [products] = useJson('/api/products')
  const product = (products || []).find(row => row.title === item.product)
  const options = useMemo(() => {
    try { return JSON.parse(product?.extra || '{}').options || [] } catch { return [] }
  }, [product])
  useEffect(() => { setDraft(null) }, [item.id])
  const siblings = useMemo(() => (rows || []).filter(r => r.product === item.product), [rows, item.product])
  const shown = siblings.filter(r => {
    if (colorFilter && (options.length ? r.option1 !== item.option1 : r.variant !== item.variant)) return false
    const q = query.trim().toLowerCase()
    return !q || r.variant.toLowerCase().includes(q)
  })

  const act = (action, extra = {}) => fetch(`/api/inventory/${item.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  }).then(async r => {
    const body = await r.json()
    if (!r.ok) throw new Error(body.error || 'Could not update this variant')
    if (body.deleted) { onOpen('inventory', { product: item.product }); return body }
    onChanged()
    if (body.id !== item.id) onOpen('inventory', { item: body.id })
    return body
  }).catch(err => setNotice(err.message))

  const shillings = (item.price / 100).toFixed(2)
  const kilos = (item.weight / 1000).toFixed(1)

  return (
    <div className="order-page">
      <div className="product-head">
        <div>
          <div className="crumb">
            <button type="button" className="text-link" onClick={() => onOpen('products')}>Products</button>
            <span>/</span>
            <button type="button" className="text-link" onClick={() => onOpen('inventory', { product: item.product })}>{item.product}</button>
            <span>/</span>
            <span>{item.variant}</span>
          </div>
          <h1>{item.variant}</h1>
        </div>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setPreview(p => !p)}><Eye size={14} /> View as</button>
          <button type="button" className="ghost" onClick={() => {
            if (options.length) setDraft({ option1: item.option1 || '', option2: item.option2 || '', option3: item.option3 || '' })
            else setDraft({ variant: `${item.variant} copy` })
          }}><Copy size={14} /> Duplicate</button>
          <div className="menu">
            <button type="button" className="ghost" aria-expanded={menu} onClick={() => setMenu(o => !o)}>More actions <ChevronDown size={14} /></button>
            {menu && (
              <div className="popover menu-pop">
                <button type="button" onClick={() => { setMenu(false); window.print() }}>Print</button>
                <button type="button" className="danger" onClick={() => { setMenu(false); act('delete') }}><Trash2 size={14} /> Delete variant</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {notice && <p className="notice">{notice}</p>}
      {draft && (
        <form className="detail-card tag-form" onSubmit={event => {
          event.preventDefault()
          act('duplicate', draft).then(body => { if (!body) return; setDraft(null); setNotice('Variant duplicated.') })
        }}>
          <p className="muted">Change at least one option value. An exact copy cannot be saved.</p>
          {options.length ? options.map((option, index) => (
            <label key={option.name} className="field">{option.name}
              <input aria-label={`Duplicate ${option.name}`} value={draft[`option${index + 1}`] || ''} onChange={e => setDraft(current => ({ ...current, [`option${index + 1}`]: e.target.value }))} />
            </label>
          )) : (
            <label className="field">Variant
              <input aria-label="Duplicate variant name" value={draft.variant || ''} onChange={e => setDraft(current => ({ ...current, variant: e.target.value }))} />
            </label>
          )}
          <button type="submit" className="solid">Save duplicate</button>
        </form>
      )}
      {preview && <section className="detail-card preview-card"><h2>{item.variant}</h2><p>{item.product}</p><p>{money(item.price)}</p><p className="muted">{item.available} available in {item.location}</p></section>}
      <div className="variant-layout">
        <aside className="detail-card variant-nav">
          <div className="variant-product">
            <span className="thumb"><Image size={16} /></span>
            <div>
              <strong>{item.product}</strong>
              <span className="status-pill active">Active</span>
              <p className="muted">{siblings.length} variants</p>
            </div>
          </div>
          <label className="finder"><Search size={15} /><input placeholder="Search variants" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <div className="orders-actions">
            <button type="button" className="ghost" onClick={() => setColorFilter(o => !o)}>{options[0]?.name || 'Variant'} <ChevronDown size={12} /></button>
            <button type="button" className="ghost" onClick={() => onOpen('orders', { channel: 'Online Store' })}>Sales channels <ChevronDown size={12} /></button>
          </div>
          <p className="muted">{shown.length} variants</p>
          <ul className="variant-list">
            {shown.map(r => (
              <li key={r.id}>
                <button type="button" className={r.id === item.id ? 'on' : ''} onClick={() => onOpen('inventory', { item: r.id })}>
                  <Image size={14} /> {r.variant}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div>
          <section className="detail-card variant-hero">
            <div className="swatch"><Plus size={18} /></div>
            <div>
              {options.length
                ? <h2>{item.variant}</h2>
                : <input className="variant-name" defaultValue={item.variant} key={item.variant} onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== item.variant) act('update', { variant: e.target.value.trim() }) }} />}
              <p><button type="button" className="text-link" onClick={() => onOpen('orders', { channel: 'Online Store' })}>All channels</button> · None</p>
            </div>
          </section>
          <section className="detail-card">
            {options.length ? options.map((option, index) => (
              <label key={option.name} className="field">{option.name}
                <input defaultValue={item[`option${index + 1}`] || ''} key={`${item.id}-${option.name}-${item[`option${index + 1}`] || ''}`} onBlur={e => {
                  const next = e.target.value.trim()
                  if (next && next !== (item[`option${index + 1}`] || '')) act('update', { [`option${index + 1}`]: next })
                }} />
              </label>
            )) : (
              <label className="field">Variant
                <span className="color-chip">{item.variant}</span>
              </label>
            )}
          </section>
          <section className="detail-card">
            <label className="field">Price
              <span className="money-input"><b>KES</b><input defaultValue={shillings} key={shillings} inputMode="decimal" onBlur={e => {
                const cents = Math.round(Number(e.target.value) * 100)
                if (Number.isFinite(cents) && cents >= 0 && cents !== item.price) act('update', { price: cents })
              }} /></span>
            </label>
            <div className="orders-actions">
              <button type="button" className="ghost" onClick={() => setCostOpen(o => !o)}>Compare-at</button>
              <button type="button" className="ghost" onClick={() => setCostOpen(o => !o)}>Unit price</button>
              <button type="button" className="ghost">Charge tax Yes</button>
              <button type="button" className="ghost" onClick={() => setCostOpen(o => !o)}>Cost per item</button>
            </div>
            {costOpen && <p className="muted">Compare-at, unit price, and cost per item stay with this variant.</p>}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h2>Inventory</h2>
              <label className="switch">Inventory tracked <input type="checkbox" checked={!!item.tracked} onChange={e => act('update', { tracked: e.target.checked })} /></label>
            </div>
            <table className="money-table">
              <thead><tr><th>Locations</th><th>Unavailable</th><th>Committed</th><th>Available</th><th>On hand</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    <select value={item.location || 'Nairobi'} onChange={e => act('update', { location: e.target.value })}>
                      {LOCATIONS.map(place => <option key={place}>{place}</option>)}
                    </select>
                  </td>
                  <td>{item.unavailable}</td>
                  <td>{item.committed}</td>
                  <td>{item.available}</td>
                  <td><input className="qty" defaultValue={item.on_hand} key={item.on_hand} inputMode="numeric" onBlur={e => {
                    const qty = Number(e.target.value)
                    if (Number.isFinite(qty) && qty >= 0 && qty !== item.on_hand) act('update', { on_hand: qty })
                  }} /></td>
                </tr>
              </tbody>
            </table>
            <button type="button" className="text-link" onClick={() => setHistory(o => !o)}>View adjustment history</button>
            {history && <p className="muted">{item.on_hand} on hand at {item.location}. No earlier adjustments.</p>}
          </section>
          <section className="detail-card">
            <div className="orders-actions">
              <button type="button" className="ghost" onClick={() => setSkuOpen(o => !o)}>SKU</button>
              <button type="button" className="ghost" onClick={() => setSkuOpen(o => !o)}>Barcodes</button>
              <span className="muted">Sell when out of stock {item.continue_selling ? 'On' : 'Off'}</span>
              <button type="button" className="ghost" onClick={() => act('update', { continue_selling: !item.continue_selling })}>{item.continue_selling ? 'Turn off' : 'Turn on'}</button>
            </div>
            {skuOpen && (
              <div className="price-grid">
                <label className="field">SKU
                  <input defaultValue={item.sku || ''} key={`${item.id}-sku-${item.sku || ''}`} onBlur={e => { if (e.target.value.trim() !== (item.sku || '')) act('update', { sku: e.target.value.trim() }) }} />
                </label>
                <label className="field">Barcode
                  <input defaultValue={item.barcode || ''} key={`${item.id}-barcode-${item.barcode || ''}`} onBlur={e => { if (e.target.value.trim() !== (item.barcode || '')) act('update', { barcode: e.target.value.trim() }) }} />
                </label>
              </div>
            )}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h2>Shipping</h2>
              <label className="switch">Physical product <input type="checkbox" checked={!!item.physical} onChange={e => act('update', { physical: e.target.checked })} /></label>
            </div>
            <label className="field">Package when shipped alone
              <select defaultValue="sample"><option value="sample">Store default • Sample box — 22 × 13.7 × 4.2 cm, 0 kg</option></select>
            </label>
            <div className="dims">
              <span>Packed product size</span>
              <label>L <input defaultValue="0.0" /></label>
              <label>W <input defaultValue="0.0" /></label>
              <label>H <input defaultValue="0.0" /></label>
              <span>cm</span>
            </div>
            <label className="field">Weight
              <span className="money-input"><input defaultValue={kilos} key={kilos} inputMode="decimal" onBlur={e => {
                const grams = Math.round(Number(e.target.value) * 1000)
                if (Number.isFinite(grams) && grams >= 0 && grams !== item.weight) act('update', { weight: grams })
              }} /><b>kg</b></span>
            </label>
            <div className="orders-actions">
              <label className="field">Country of origin
                <select value={item.origin || ''} onChange={e => act('update', { origin: e.target.value })}>
                  <option value="">Country of origin</option>
                  <option>Kenya</option>
                  <option>Uganda</option>
                  <option>Tanzania</option>
                </select>
              </label>
              <label className="field">HS code
                <select value={item.hs_code || ''} onChange={e => act('update', { hs_code: e.target.value })}>
                  <option value="">HS code</option>
                  <option>6001.22</option>
                  <option>6205.20</option>
                  <option>4202.91</option>
                </select>
              </label>
            </div>
          </section>
          <div className="orders-actions">
            <button type="button" className="ghost danger-btn" onClick={() => act('delete')}><Trash2 size={14} /> Delete variant</button>
          </div>
        </div>
      </div>
    </div>
  )
}
