import { Fragment, useMemo, useState } from 'react'
import { Calendar, Hash, Image, Link2, MapPin, Search, StickyNote, Tag } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { money } from '../lib/money.js'
import { useJson } from '../lib/api.js'

const PLACES = ['Nairobi', 'Kisumu', 'Mombasa']
const SUPPLIERS = ['Korom Textiles', 'Mwotaji Ltd', 'Hawkeye Media']

function code() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 17 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function lineFrom(item) {
  return { inventory_id: item.id, title: `${item.product} · ${item.variant}`, qty: 1, price: item.price || 0, sku: item.sku || '' }
}

function atDestination(item, destination) {
  if (!destination || (item.location || 'Nairobi') === destination) return item.available
  return 0
}

export function AddProducts({ inventory, lines, destination, onAdd, hideLines = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchBy, setSearchBy] = useState('All')
  const [picked, setPicked] = useState([])
  const chosen = new Set(lines.map(line => line.inventory_id))
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
  }, [inventory, lines, query, searchBy])
  const toggle = id => setPicked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const toggleGroup = variants => {
    const ids = variants.map(item => item.id)
    const all = ids.every(id => picked.includes(id))
    setPicked(current => all ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])])
  }
  const addChosen = () => {
    const items = (inventory || []).filter(item => picked.includes(item.id))
    if (items.length) onAdd(items)
    setPicked([])
    setQuery('')
    setOpen(false)
  }
  return (
    <div className="po-search">
      <button type="button" className="po-open" onClick={() => { setPicked([]); setOpen(true) }}>
        <Search size={15} /> Search products to add
      </button>
      {open && (
        <Modal title="Add products" onClose={() => setOpen(false)}>
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
                  <tr><th /><th>Product</th><th>Available at Destination</th><th>Available</th></tr>
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
                            <td>{atDestination(item, destination)}</td>
                            <td>{item.available}</td>
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
            <span className="muted">{picked.length} {picked.length === 1 ? 'variant' : 'variants'} selected</span>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="solid" disabled={!picked.length} onClick={addChosen}>Add to purchase order</button>
          </div>
        </Modal>
      )}
      {!hideLines && lines.length > 0 && (
        <ul className="variant-list">
          {lines.map(line => <li key={line.inventory_id}><span>{line.title} × {line.qty}</span><b>{money(line.price * line.qty)}</b></li>)}
        </ul>
      )}
    </div>
  )
}

export function ProductSearch({ inventory, lines, onAdd, hideLines = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const chosen = new Set(lines.map(line => line.inventory_id))
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (inventory || [])
      .filter(item => !chosen.has(item.id))
      .filter(item => !q || `${item.product} ${item.variant} ${item.sku || ''}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [inventory, query, lines])
  return (
    <div className="po-search">
      <label className="finder">
        <Search size={15} />
        <input
          aria-label="Search inventory"
          placeholder="Search products to add"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
        />
      </label>
      {open && (
        <div className="library">
          {hits.map(item => (
            <button
              type="button"
              className="inventory-hit"
              key={item.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onAdd(item); setQuery(''); setOpen(false) }}
            >
              <span>
                {item.product}
                <small>{item.variant} · {item.on_hand} on hand{item.sku ? ` · ${item.sku}` : ''}</small>
              </span>
              <b>{money(item.price || 0)}</b>
            </button>
          ))}
          {!inventory && <p className="muted">Loading inventory…</p>}
          {inventory && hits.length === 0 && <p className="muted">No inventory matches.</p>}
        </div>
      )}
      {!hideLines && lines.length > 0 && (
        <ul className="variant-list">
          {lines.map(line => <li key={line.inventory_id}><span>{line.title} × {line.qty}</span><b>{money(line.price * line.qty)}</b></li>)}
        </ul>
      )}
    </div>
  )
}

export function CreatePurchaseOrder({ onOpen, onSaved }) {
  const [inventory] = useJson('/api/inventory')
  const [supplier, setSupplier] = useState('')
  const [destination, setDestination] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [terms, setTerms] = useState('')
  const [tags, setTags] = useState('')
  const [lines, setLines] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const units = lines.reduce((sum, line) => sum + line.qty, 0)
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  const add = items => setLines(prev => {
    const incoming = Array.isArray(items) ? items : [items]
    const ids = new Set(prev.map(line => line.inventory_id))
    return [...prev, ...incoming.filter(item => !ids.has(item.id)).map(lineFrom)]
  })
  const save = e => {
    e.preventDefault()
    if (!supplier) { setError('Select a supplier.'); return }
    setBusy(true)
    fetch('/api/purchase-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier, destination, reference, note, terms, currency: 'KES', tags, lines }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      const created = await r.json()
      onSaved()
      onOpen('purchase-orders', { po: created.id })
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <form className="order-page" onSubmit={save}>
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('purchase-orders')}>Purchase orders</button>
        <span>/</span><span>Create purchase order</span>
      </div>
      <div className="product-head">
        <h1>Create purchase order</h1>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid">
        <div>
          <section className="detail-card route-card">
            <MapPin size={16} />
            <select value={supplier} onChange={e => setSupplier(e.target.value)} aria-label="Supplier">
              <option value="">Select supplier</option>
              {SUPPLIERS.map(name => <option key={name}>{name}</option>)}
            </select>
            <span>→</span>
            <MapPin size={16} />
            <select value={destination} onChange={e => setDestination(e.target.value)} aria-label="Destination">
              <option value="">Select destination</option>
              {PLACES.map(place => <option key={place}>{place}</option>)}
            </select>
          </section>
          <AddProducts inventory={inventory} lines={lines} destination={destination} onAdd={add} />
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <h2>Cost summary</h2>
            <table className="money-table">
              <tbody>
                <tr><td>Order details</td><td>{lines.length} variants ({units} items)</td></tr>
                <tr><td>Taxes (Included)</td><td>KES 0.00</td></tr>
                <tr className="total-row"><td>Total</td><td>{money(total)}</td></tr>
              </tbody>
            </table>
          </section>
          <section className="detail-card">
            <h2>Purchase order details</h2>
            <label className="field">Reference number
              <input value={reference} maxLength={255} onChange={e => setReference(e.target.value)} />
              <small className="muted">{reference.length}/255</small>
            </label>
            <label className="field">Note to supplier
              <textarea value={note} maxLength={5000} onChange={e => setNote(e.target.value)} />
              <small className="muted">{note.length}/5000</small>
            </label>
            <div className="orders-actions">
              <span>Terms</span>
              <select value={terms} onChange={e => setTerms(e.target.value)} aria-label="Terms">
                <option value="">None</option>
                <option>Due on receipt</option>
                <option>Net 30</option>
              </select>
              <span>Currency</span>
              <select defaultValue="KES" aria-label="Currency"><option>KES</option></select>
            </div>
          </section>
          <section className="detail-card">
            <h2>Tags</h2>
            <input value={tags} maxLength={40} onChange={e => setTags(e.target.value)} placeholder="Add tags" />
            <small className="muted">{tags.length}/40</small>
          </section>
        </aside>
      </div>
    </form>
  )
}

export function CreateTransfer({ onOpen, onSaved }) {
  const [inventory] = useJson('/api/inventory')
  const [orders] = useJson('/api/purchase-orders')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [purchaseOrder, setPurchaseOrder] = useState('')
  const [lines, setLines] = useState([])
  const [openField, setOpenField] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const add = item => setLines(prev => prev.some(line => line.inventory_id === item.id) ? prev : [...prev, { inventory_id: item.id, title: `${item.product} · ${item.variant}`, qty: 1, price: item.price || 0 }])
  const save = e => {
    e.preventDefault()
    if (!origin || !destination) { setError('Select an origin and a destination.'); return }
    setBusy(true)
    fetch('/api/transfers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, reference, note, tags, purchase_order: purchaseOrder, lines }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      const created = await r.json()
      onSaved()
      onOpen('transfers', { transfer: created.id })
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <form className="order-page" onSubmit={save}>
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('transfers')}>Transfers</button>
        <span>/</span><span>Create transfer</span>
      </div>
      <div className="product-head">
        <h1>Create transfer</h1>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <section className="detail-card route-card">
        <MapPin size={16} />
        <select value={origin} onChange={e => setOrigin(e.target.value)} aria-label="Origin">
          <option value="">Select origin</option>
          {PLACES.map(place => <option key={place}>{place}</option>)}
        </select>
        <span>→</span>
        <span className="transit">In transit</span>
        <span>→</span>
        <MapPin size={16} />
        <select value={destination} onChange={e => setDestination(e.target.value)} aria-label="Destination">
          <option value="">Select destination</option>
          {PLACES.map(place => <option key={place}>{place}</option>)}
        </select>
      </section>
      <ProductSearch inventory={inventory} lines={lines} onAdd={add} />
      <section className="detail-card">
        <h2>Transfer details</h2>
        <p><Calendar size={15} /> October 14, 2026</p>
        <button type="button" className="text-link block-link" onClick={() => setOpenField('reference')}><StickyNote size={15} /> {reference || 'Add reference name'}</button>
        {openField === 'reference' && <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference name" autoFocus />}
        <button type="button" className="text-link block-link" onClick={() => setOpenField('note')}><StickyNote size={15} /> {note || 'Add note'}</button>
        {openField === 'note' && <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note" />}
        <button type="button" className="text-link block-link" onClick={() => setOpenField('tags')}><Hash size={15} /> {tags || 'Add tags'}</button>
        {openField === 'tags' && <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags" />}
        <button type="button" className="text-link block-link" onClick={() => setOpenField('po')}><Link2 size={15} /> {purchaseOrder ? `PO ${purchaseOrder}` : 'Link purchase order'}</button>
        {openField === 'po' && (
          <select value={purchaseOrder} onChange={e => setPurchaseOrder(e.target.value)}>
            <option value="">None</option>
            {(orders || []).map(order => <option key={order.id} value={order.id}>#{order.id} · {order.supplier}</option>)}
          </select>
        )}
      </section>
    </form>
  )
}

export function CreateGiftCard({ onOpen, onSaved }) {
  const [customers] = useJson('/api/customers')
  const [cardCode] = useState(code)
  const [amount, setAmount] = useState('10.00')
  const [expires, setExpires] = useState('')
  const [customer, setCustomer] = useState('')
  const [note, setNote] = useState('')
  const [noting, setNoting] = useState(false)
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mark = updater => value => { setDirty(true); updater(value) }
  const matches = (customers || []).filter(person => query && person.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
  const discard = () => onOpen('gift-cards')
  const save = () => {
    const cents = Math.round(Number(amount) * 100)
    if (!Number.isFinite(cents) || cents < 0) { setError('Enter an initial value.'); return }
    setBusy(true)
    fetch('/api/gift-cards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cardCode, customer, balance: cents, note, expires }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      onSaved()
      onOpen('gift-cards')
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <div className="order-page">
      {dirty && (
        <div className="save-bar">
          <span>Unsaved changes</span>
          <button type="button" className="ghost" onClick={discard}>Discard</button>
          <button type="button" className="solid" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('gift-cards')}>Gift cards</button>
      </div>
      <h1>Create gift card</h1>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid">
        <section className="detail-card">
          <h2>Gift card details</h2>
          <label className="field">Gift card code
            <input value={cardCode} readOnly />
          </label>
          <div className="gift-row">
            <label className="field">Initial value
              <span className="money-input"><b>KES</b><input value={amount} inputMode="decimal" onChange={e => mark(setAmount)(e.target.value)} /></span>
            </label>
            <label className="field">Expiry date
              <span className="money-input"><Calendar size={14} /><input type="date" value={expires} onChange={e => mark(setExpires)(e.target.value)} />{!expires && <em>Doesn't expire</em>}</span>
            </label>
          </div>
          <p className="muted">Gift card expiration laws can vary by country</p>
        </section>
        <aside className="order-side">
          <section className="detail-card">
            <label className="field">Customer
              <label className="finder"><Search size={15} /><input placeholder="Search or create customer" value={query} onChange={e => { setQuery(e.target.value); setDirty(true) }} /></label>
            </label>
            {matches.map(person => (
              <button type="button" key={person.id} className="text-link" onClick={() => { setCustomer(person.name); setQuery(person.name); setDirty(true) }}>{person.name}</button>
            ))}
            {customer && <p>{customer}</p>}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h2>Notes</h2>
              <button type="button" className="icon-btn" aria-label="Add note" onClick={() => setNoting(true)}><Tag size={14} /></button>
            </div>
            {!noting && !note && <p className="muted">No notes</p>}
            {noting && <textarea value={note} onChange={e => mark(setNote)(e.target.value)} placeholder="Note" />}
          </section>
        </aside>
      </div>
    </div>
  )
}
