import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Info, Pencil, Plus, Search, X } from 'lucide-react'
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
  const [customers] = useJson('/api/customers')
  const [lines, setLines] = useState([])
  const [customer, setCustomer] = useState(initialCustomer)
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

  const productHits = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    return (products || []).filter(row => !q || row.title.toLowerCase().includes(q)).slice(0, 6)
  }, [products, productQuery])
  const customerHits = useMemo(() => {
    const q = customer.trim().toLowerCase()
    if (q.length < 1) return []
    return (customers || []).filter(row => row.name.toLowerCase().includes(q) && row.name !== customer).slice(0, 5)
  }, [customers, customer])

  useEffect(() => { setError('') }, [customer, lines])

  const addLine = (title, priceCents, qty = 1) => {
    setLines(current => [...current, { key: `${title}-${Date.now()}`, title, price: priceCents, qty }])
  }
  const addProduct = product => {
    addLine(product.title, product.price, 1)
    setPicking(false)
    setProductQuery('')
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
        lines: lines.map(line => ({ title: line.title, price: line.price, qty: line.qty })),
        discount: discountCents,
        shipping,
        note: note.trim(),
        tags: tags.trim(),
        currency,
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
        onOpen('drafts', { draft: body.id })
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

  return (
    <div className="order-page">
      <div className="crumb">
        <button type="button" className="text-link back" onClick={() => onOpen('drafts')}><ChevronLeft size={16} /> Drafts</button>
      </div>
      <div className="order-head">
        <h1 className="title">Create order</h1>
        <button type="button" className="solid" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="order-grid">
        <div>
          <h2 className="section-label">Products</h2>
          <section className="detail-card product-drop">
            {lines.map(line => (
              <div className="line-row" key={line.key}>
                <strong>{line.title}</strong>
                <span className="muted">{price(line.price)} × {line.qty}</span>
                <b>{price(line.price * line.qty)}</b>
                <button type="button" className="icon-btn" aria-label={`Remove ${line.title}`} onClick={() => setLines(current => current.filter(item => item.key !== line.key))}><X size={14} /></button>
              </div>
            ))}
            <div className="drop-actions">
              <button type="button" className="ghost" onClick={() => { setCustomOpen(o => !o); setPicking(false) }}><Plus size={14} /> Custom item</button>
              <button type="button" className="ghost" onClick={() => { setPicking(o => !o); setCustomOpen(false) }}><Plus size={14} /> Product</button>
            </div>
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
                  <button type="button" key={product.id} onClick={() => addProduct(product)}>{product.title}<span>{money(product.price)}</span></button>
                ))}
                {products && productHits.length === 0 && <p className="muted">No products match.</p>}
              </div>
            )}
          </section>
          <h2 className="section-label">Payment</h2>
          <section className="detail-card pay-card">
            <div className="pay-line"><span>Subtotal</span><span /><b>{price(subtotal)}</b></div>
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
              <div className="pay-options">
                <p className="due-note">Send an invoice with a checkout link, or mark the draft as paid if you already received payment.</p>
                <button type="button" className="ghost" disabled={busy} onClick={() => save('invoice')}>Send invoice</button>
                <button type="button" className="solid" disabled={busy} onClick={() => save('paid')}>Mark as paid</button>
              </div>
            )}
          </section>
          {error && <p className="form-error">{error}</p>}
        </div>
        <aside className="order-side">
          <section className="detail-card side-head">
            <h2>Notes</h2>
            <button type="button" className="icon-btn" aria-label="Add note" onClick={() => setNoteOpen(o => !o)}><Plus size={16} /></button>
          </section>
          {noteOpen && (
            <section className="detail-card">
              <textarea rows={4} placeholder="Add a note" value={note} onChange={e => setNote(e.target.value)} />
            </section>
          )}
          <section className="detail-card">
            <h2>Customer</h2>
            <label className="finder"><Search size={15} /><input placeholder="Search or create a customer" value={customer} onChange={e => setCustomer(e.target.value)} /></label>
            {customerHits.length > 0 && (
              <div className="picker">
                {customerHits.map(row => (
                  <button type="button" key={row.id} onClick={() => setCustomer(row.name)}>{row.name}<span>{row.email}</span></button>
                ))}
              </div>
            )}
          </section>
          <section className="detail-card">
            <h2>Markets</h2>
            <span className="market-pill">{market}</span>
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
