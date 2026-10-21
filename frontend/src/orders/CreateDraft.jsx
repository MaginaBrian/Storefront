import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Info, MoreHorizontal, Pencil, Plus, Search, Store, X } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { money } from '../lib/money.js'

const CURRENCIES = [
  ['KES', 'Kenyan Shilling (KES)', 'Kenya'],
  ['UGX', 'Ugandan Shilling (UGX)', 'Uganda'],
  ['TZS', 'Tanzanian Shilling (TZS)', 'Tanzania'],
]

function cents(value) {
  const n = Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export default function CreateDraft({ onOpen, initialCustomer = '' }) {
  const [products] = useJson('/api/products')
  const [inventory] = useJson('/api/inventory')
  const [customers] = useJson('/api/customers')
  const [lines, setLines] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [more, setMore] = useState(false)
  const [dueLater, setDueLater] = useState(true)
  const [customer, setCustomer] = useState(initialCustomer)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [currency, setCurrency] = useState('KES')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [picking, setPicking] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState({ title: '', price: '', qty: '1' })
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountKind, setDiscountKind] = useState('amount')
  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState(null)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [shippingInput, setShippingInput] = useState('')
  const [shipping, setShipping] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const market = CURRENCIES.find(([code]) => code === currency)?.[2] || 'Kenya'
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  const discountCents = discount?.kind === 'percent'
    ? Math.round(subtotal * discount.value / 100)
    : Math.min(discount?.cents || 0, subtotal)
  const total = Math.max(subtotal - discountCents, 0) + shipping
  const tax = lines.length ? Math.round(total * 16 / 116) : null
  const price = centsValue => currency === 'KES' ? money(centsValue) : `${currency} ${(centsValue / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const catalog = useMemo(() => {
    const stock = (inventory || []).map(row => ({
      key: `i-${row.id}`, title: row.product, variant: row.variant || '', price: row.price || 0,
    }))
    const goods = (products || []).map(row => ({
      key: `p-${row.id}`, title: row.title, variant: row.color || '', price: row.price || 0,
    }))
    return [...stock, ...goods]
  }, [inventory, products])
  const productHits = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    return catalog.filter(row => !q || `${row.title} ${row.variant}`.toLowerCase().includes(q)).slice(0, 8)
  }, [catalog, productQuery])
  const customerHits = useMemo(() => {
    const q = customer.trim().toLowerCase()
    if (q.length < 1) return []
    return (customers || []).filter(row => row.name.toLowerCase().includes(q) && row.name !== customer).slice(0, 5)
  }, [customers, customer])

  useEffect(() => { setError('') }, [customer, lines])

  const addLine = (title, priceCents, qty = 1, variant = '') => {
    setLines(current => [...current, { key: `${title}-${variant}-${Date.now()}`, title, variant, size: '', color: variant, price: priceCents, qty }])
  }
  const setLine = (key, patch) => setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line))
  const addProduct = product => {
    addLine(product.title, product.price, 1, product.variant || '')
    setPicking(false)
    setProductQuery('')
  }
  const setQty = (key, value) => {
    const qty = Number(value)
    if (!Number.isInteger(qty) || qty < 1) return
    setLines(current => current.map(line => line.key === key ? { ...line, qty } : line))
  }
  const toggleLine = key => setSelected(current => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const removeSelected = () => {
    setLines(current => current.filter(line => !selected.has(line.key)))
    setSelected(new Set())
    setMore(false)
  }
  const addCustom = () => {
    const priceCents = cents(custom.price)
    const qty = Number(custom.qty)
    if (!custom.title.trim() || priceCents == null || !Number.isInteger(qty) || qty < 1) {
      setError('Enter an item name, price, and quantity.')
      return
    }
    addLine(custom.title.trim(), priceCents, qty)
    setCustom({ title: '', price: '', qty: '1' })
    setCustomOpen(false)
  }
  const applyDiscount = () => {
    if (discountKind === 'percent') {
      const value = Number(discountInput)
      if (!Number.isFinite(value) || value < 0 || value > 100) { setError('Enter a discount between 0 and 100%.'); return }
      setDiscount({ kind: 'percent', value })
    } else {
      const value = cents(discountInput)
      if (value == null) { setError('Enter a discount amount.'); return }
      setDiscount({ kind: 'amount', cents: value })
    }
    setDiscountOpen(false)
    setError('')
  }
  const applyShipping = () => {
    const value = cents(shippingInput)
    if (value == null) { setError('Enter a shipping amount.'); return }
    setShipping(value)
    setShippingOpen(false)
    setError('')
  }

  const save = intent => {
    if (!customer.trim()) { setError('Choose a customer before saving this draft.'); return }
    setBusy(true)
    setError('')
    fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customer.trim(),
        lines: lines.map(line => ({ title: line.title, price: line.price, qty: line.qty, size: line.size, color: line.color || line.variant || '' })),
        discount: discountCents,
        shipping,
        note: note.trim(),
        tags: tags.trim(),
        currency,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      }),
    }).then(async r => {
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Could not save this draft')
      if (intent === 'invoice') {
        const sent = await fetch(`/api/drafts/${body.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'invoice' }),
        })
        if (!sent.ok) throw new Error('The draft was saved, but the invoice was not sent.')
        onOpen('drafts', { draft: body.id, invoice: '1' })
        return
      }
      if (intent === 'paid') {
        const paid = await fetch(`/api/drafts/${body.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'order', payment: 'paid' }),
        })
        const paidBody = await paid.json()
        if (!paid.ok) throw new Error(paidBody.error || 'Could not mark this draft as paid')
        onOpen('orders', { order: paidBody.order_id })
        return
      }
      onOpen('drafts', { draft: body.id })
    }).catch(err => { setError(err.message); setBusy(false) })
  }

  const discountLabel = discount?.kind === 'percent' ? `${discount.value}%` : discount ? price(discount.cents) : '—'
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0)
  const dirty = lines.length > 0 || customer !== initialCustomer || phone.trim() !== '' || email.trim() !== '' || address.trim() !== '' || note.trim() !== '' || tags.trim() !== '' || discount != null || shipping > 0 || currency !== 'KES' || !dueLater

  return (
    <div className="order-page">
      <div className="create-bar">
        <button type="button" className="text-link back" onClick={() => onOpen('drafts')}><ChevronLeft size={16} /> Drafts</button>
        <div className="create-actions">
          {dirty && <span className="unsaved">Unsaved changes</span>}
          <button type="button" className="ghost" disabled={!dirty || busy} onClick={() => onOpen('drafts')}>Discard</button>
          <button type="button" className="solid" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <h1 className="title">Create order</h1>
      <div className="order-grid">
        <div>
          <section className="detail-card product-drop">
            <div className="card-title">
              <h2>Products</h2>
              <div className="card-tools">
                <div className="menu">
                  <button type="button" className="icon-btn" aria-label="More product actions" onClick={() => setMore(o => !o)}><MoreHorizontal size={16} /></button>
                  {more && (
                    <div className="menu-pop">
                      <button type="button" disabled={selected.size === 0} onClick={removeSelected}>Remove selected</button>
                    </div>
                  )}
                </div>
                <button type="button" className="ghost" onClick={() => { setCustomOpen(o => !o); setPicking(false) }}>Custom item</button>
                <button type="button" className="ghost" onClick={() => { setPicking(o => !o); setCustomOpen(false) }}><Plus size={14} /> Product</button>
              </div>
            </div>
            {lines.map(line => (
              <div className="draft-line" key={line.key}>
                <input type="checkbox" aria-label={`Select ${line.title}`} checked={selected.has(line.key)} onChange={() => toggleLine(line.key)} />
                <span className="thumb" aria-hidden="true" />
                <span>
                  <strong>{line.title}</strong>
                  <span className="line-meta">
                    <input aria-label={`Size for ${line.title}`} placeholder="Size" value={line.size} onChange={e => setLine(line.key, { size: e.target.value })} />
                    <input aria-label={`Color for ${line.title}`} placeholder="Color" value={line.color} onChange={e => setLine(line.key, { color: e.target.value })} />
                  </span>
                </span>
                <span>{price(line.price)}</span>
                <input className="qty-input" inputMode="numeric" aria-label={`Quantity for ${line.title}`} value={line.qty} onChange={e => setQty(line.key, e.target.value)} />
                <b>{price(line.price * line.qty)}</b>
                <button type="button" className="icon-btn" aria-label={`Remove ${line.title}`} onClick={() => setLines(current => current.filter(item => item.key !== line.key))}><X size={14} /></button>
              </div>
            ))}
            {lines.length === 0 && <p className="muted">Add a product or a custom item.</p>}
            {customOpen && (
              <div className="inline-form">
                <input placeholder="Item name" value={custom.title} onChange={e => setCustom(c => ({ ...c, title: e.target.value }))} />
                <input inputMode="decimal" placeholder="Price" value={custom.price} onChange={e => setCustom(c => ({ ...c, price: e.target.value }))} />
                <input inputMode="numeric" aria-label="Quantity" value={custom.qty} onChange={e => setCustom(c => ({ ...c, qty: e.target.value }))} />
                <button type="button" className="solid" onClick={addCustom}>Add</button>
              </div>
            )}
            {picking && (
              <div className="picker">
                <label className="finder"><Search size={15} /><input autoFocus placeholder="Search products" value={productQuery} onChange={e => setProductQuery(e.target.value)} /></label>
                {productHits.map(product => (
                  <button type="button" key={product.key} onClick={() => addProduct(product)}>
                    <span>{product.title}{product.variant ? <small>{product.variant}</small> : null}</span>
                    <span>{money(product.price)}</span>
                  </button>
                ))}
                {catalog.length > 0 && productHits.length === 0 && <p className="muted">No products match.</p>}
              </div>
            )}
          </section>
          <section className="detail-card pay-card">
            <div className="card-title">
              <h2>Payment</h2>
              {lines.length > 0 && (
                <div className="card-tools">
                  <button type="button" className="ghost" disabled={busy} onClick={() => save('invoice')}>Send invoice</button>
                  <button type="button" className="solid" disabled={busy} onClick={() => save('paid')}>Mark as paid</button>
                </div>
              )}
            </div>
            <div className="pay-line"><span>Subtotal</span><span className="muted">{itemCount === 0 ? '' : `${itemCount} item${itemCount === 1 ? '' : 's'}`}</span><b>{price(subtotal)}</b></div>
            <div className="pay-line">
              <button type="button" className="text-link" onClick={() => setDiscountOpen(o => !o)}>Add discount</button>
              <span className="muted">{discountLabel}</span>
              <b>{price(discountCents)}</b>
            </div>
            {discountOpen && (
              <div className="inline-form">
                <select aria-label="Discount type" value={discountKind} onChange={e => setDiscountKind(e.target.value)}>
                  <option value="amount">Amount</option>
                  <option value="percent">Percentage</option>
                </select>
                <input inputMode="decimal" placeholder={discountKind === 'percent' ? '10' : '0.00'} value={discountInput} onChange={e => setDiscountInput(e.target.value)} />
                <button type="button" className="solid" onClick={applyDiscount}>Apply</button>
              </div>
            )}
            <div className="pay-line">
              <button type="button" className="text-link" onClick={() => setShippingOpen(o => !o)}>Add shipping or delivery</button>
              <span className="muted">{shipping ? price(shipping) : '—'}</span>
              <b>{price(shipping)}</b>
            </div>
            {shippingOpen && (
              <div className="inline-form">
                <input inputMode="decimal" placeholder="0.00" value={shippingInput} onChange={e => setShippingInput(e.target.value)} />
                <button type="button" className="solid" onClick={applyShipping}>Apply</button>
              </div>
            )}
            <div className="pay-line">
              <span>Estimated tax <Info size={13} aria-label="16% VAT is included in the total once products are added" /></span>
              <span className="muted">{tax == null ? 'Not calculated' : `${price(tax)} · 16% VAT`}</span>
              <b>{tax == null ? '' : 'Included'}</b>
            </div>
            <div className="pay-line total"><span>Total</span><span /><b>{price(total)}</b></div>
            {lines.length === 0 ? (
              <p className="due-note">Add a product to calculate total and view payment options</p>
            ) : (
              <div className="due-row">
                <span>Payment due later</span>
                <button type="button" className={dueLater ? 'switch on' : 'switch'} role="switch" aria-checked={dueLater} aria-label="Payment due later" onClick={() => setDueLater(value => !value)}><i /></button>
              </div>
            )}
          </section>
          {error && <p className="form-error">{error}</p>}
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <div className="side-head">
              <h2>Notes</h2>
              <button type="button" className="icon-btn" aria-label="Add note" onClick={() => setNoteOpen(o => !o)}><Plus size={16} /></button>
            </div>
            {noteOpen && <textarea rows={4} placeholder="Add a note" value={note} onChange={e => setNote(e.target.value)} />}
          </section>
          <section className="detail-card">
            <h2>Customer</h2>
            <label className="finder"><Search size={15} /><input placeholder="Search or create a customer" value={customer} onChange={e => setCustomer(e.target.value)} /></label>
            {customerHits.length > 0 && (
              <div className="picker">
                {customerHits.map(row => (
                  <button type="button" key={row.id} onClick={() => {
                    setCustomer(row.name)
                    setEmail(row.email || '')
                    setPhone(row.phone || '')
                    setAddress(row.address || (row.location ? `${row.location}, Kenya` : ''))
                  }}>{row.name}<span>{row.email}</span></button>
                ))}
              </div>
            )}
            <label className="field">Mobile<input value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <label className="field">Email<input value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label className="field">Delivery address<input value={address} onChange={e => setAddress(e.target.value)} /></label>
          </section>
          <section className="detail-card">
            <h2>Markets</h2>
            <div className="market-row">
              <span className="market-pill">{market}</span>
              <button type="button" className="icon-btn" aria-label={`Open ${market} market`} onClick={() => onOpen('markets', { market })}><Store size={16} /></button>
            </div>
          </section>
          <section className="detail-card">
            <h2>Currency</h2>
            <select className="currency-select" aria-label="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </section>
          <section className="detail-card">
            <h2>Tags</h2>
            <label className="finder"><input placeholder="Add tags" value={tags} onChange={e => setTags(e.target.value)} /><Pencil size={14} /></label>
          </section>
        </aside>
      </div>
    </div>
  )
}
