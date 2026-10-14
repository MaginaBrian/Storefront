import { useEffect, useMemo, useRef, useState } from 'react'
import { Columns3, FileText, Search, X } from 'lucide-react'

const money = cents => `KES ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function formatWhen(iso) {
  const d = new Date(iso)
  const month = d.toLocaleString('en-US', { month: 'short' })
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${month} ${d.getDate()} at ${h}:${m} ${ap}`
}

function useJson(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const load = () => fetch(path).then(r => {
    if (!r.ok) throw new Error()
    return r.json()
  }).then(d => { setData(d); setError(null) }).catch(() => setError('Could not load this list.'))
  useEffect(() => { load() }, [path])
  return [data, load, error]
}

function csv(rows, name) {
  const body = rows.map(r => r.map(c => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function Tag({ kind, children }) {
  return <span className={`tag ${kind}`}><i />{children}</span>
}

function Modal({ title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    el.showModal()
    return () => { if (el.open) el.close() }
  }, [])
  return (
    <dialog ref={ref} className="modal" onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose() }}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </div>
      {children}
    </dialog>
  )
}

function OrderForm({ mode, onClose, onSaved }) {
  const [customer, setCustomer] = useState('')
  const [total, setTotal] = useState('')
  const [items, setItems] = useState('1')
  const [po, setPo] = useState('')
  const [channel, setChannel] = useState('Draft Orders')
  const [payment, setPayment] = useState('pending')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = e => {
    e.preventDefault()
    if (!customer.trim()) { setError('Enter a customer name.'); return }
    const cents = Math.round(Number(total) * 100)
    if (!Number.isFinite(cents) || cents < 0) { setError('Enter a valid total.'); return }
    const body = mode === 'draft'
      ? { customer: customer.trim(), total: cents, po: po.trim() }
      : { customer: customer.trim(), total: cents, items: Number(items) || 1, channel, payment }
    setBusy(true)
    fetch(mode === 'draft' ? '/api/drafts' : '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      onSaved()
      onClose()
    }).catch(err => { setError(err.message); setBusy(false) })
  }

  return (
    <Modal title={mode === 'draft' ? 'Create draft order' : 'Create order'} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Customer<input autoFocus value={customer} onChange={e => setCustomer(e.target.value)} /></label>
        <label>Total (KES)<input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="0.00" /></label>
        {mode === 'draft'
          ? <label>PO number<input value={po} onChange={e => setPo(e.target.value)} /></label>
          : <>
            <label>Items<input inputMode="numeric" value={items} onChange={e => setItems(e.target.value)} /></label>
            <label>Channel
              <select value={channel} onChange={e => setChannel(e.target.value)}>
                <option>Draft Orders</option><option>Online Store</option><option>Agentic</option>
              </select>
            </label>
            <label>Payment
              <select value={payment} onChange={e => setPayment(e.target.value)}>
                <option value="pending">Payment pending</option>
                <option value="paid">Paid</option>
              </select>
            </label>
          </>}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

const ORDER_COLS = [
  ['fulfill', 'Fulfill by'],
  ['channel', 'Channel'],
  ['payment', 'Payment status'],
  ['fulfillment', 'Fulfillment status'],
  ['items', 'Items'],
  ['delivery', 'Delivery status'],
  ['method', 'Delivery method'],
]

function OrdersList({ onChanged }) {
  const [rows, reload, error] = useJson('/api/orders')
  const [summary, reloadSummary] = useJson('/api/orders/summary')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('desc')
  const [picked, setPicked] = useState(() => new Set())
  const [cols, setCols] = useState(() => Object.fromEntries(ORDER_COLS.map(([k]) => [k, true])))
  const [colsOpen, setColsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const headRef = useRef(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows || []).filter(r => {
      if (filter === 'pending' && r.payment !== 'pending') return false
      if (filter === 'paid' && r.payment !== 'paid') return false
      if (filter === 'unfulfilled' && r.fulfillment !== 'unfulfilled') return false
      if (filter === 'fulfilled' && r.fulfillment !== 'fulfilled') return false
      if (!q) return true
      return [r.id, r.customer, r.channel, r.delivery_method].join(' ').toLowerCase().includes(q)
    }).sort((a, b) => sort === 'asc' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  }, [rows, query, filter, sort])

  const allPicked = shown.length > 0 && shown.every(r => picked.has(r.id))
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = picked.size > 0 && !allPicked
  }, [picked, allPicked])

  const exportRows = () => csv([
    ['Order', 'Date', 'Customer', 'Channel', 'Total', 'Payment', 'Fulfillment', 'Items', 'Delivery method'],
    ...shown.map(r => [r.id, formatWhen(r.created_at), r.customer, r.channel, money(r.total), r.payment, r.fulfillment, r.items, r.delivery_method]),
  ])

  const saved = () => { reload(); reloadSummary(); onChanged() }
  const metrics = summary || { orders: 0, items: 0, reversals: 0, fulfilled: 0, delivered: 0 }

  return (
    <>
      <div className="orders-top">
        <h1>Orders</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={exportRows}>Export</button>
          <button type="button" className="solid" onClick={() => setCreating(true)}>Create order</button>
        </div>
      </div>
      <section className="metrics" aria-label="Today">
        <div className="metric period"><span>Today</span></div>
        {[['Orders', metrics.orders], ['Items ordered', metrics.items.toLocaleString()], ['Sales reversals', money(metrics.reversals)], ['Orders fulfilled', metrics.fulfilled], ['Orders delivered', metrics.delivered]].map(([k, v]) => (
          <div className="metric" key={k}><span>{k}</span><strong>{v}</strong><i className="tick" /></div>
        ))}
      </section>
      <div className="sheet">
        <div className="toolbar">
          <select aria-label="Filter orders" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Payment pending</option>
            <option value="paid">Paid</option>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="fulfilled">Fulfilled</option>
          </select>
          <label className="finder"><Search size={15} /><input placeholder="Search and filter" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <button type="button" className="icon-btn" aria-label="Choose columns" aria-expanded={colsOpen} onClick={() => setColsOpen(o => !o)}><Columns3 size={16} /></button>
          {colsOpen && (
            <div className="popover">
              {ORDER_COLS.map(([key, label]) => (
                <label key={key}><input type="checkbox" checked={cols[key]} onChange={() => setCols(c => ({ ...c, [key]: !c[key] }))} />{label}</label>
              ))}
            </div>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input ref={headRef} type="checkbox" aria-label="Select all orders" checked={allPicked} onChange={e => setPicked(e.target.checked ? new Set(shown.map(r => r.id)) : new Set())} /></th>
                <th>Order</th>
                <th><button type="button" className="sort" onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}>Date {sort === 'desc' ? '↓' : '↑'}</button></th>
                <th>Customer</th>
                {cols.fulfill && <th>Fulfill by</th>}
                {cols.channel && <th>Channel</th>}
                <th>Total</th>
                {cols.payment && <th>Payment status</th>}
                {cols.fulfillment && <th>Fulfillment status</th>}
                {cols.items && <th>Items</th>}
                {cols.delivery && <th>Delivery status</th>}
                {cols.method && <th>Delivery method</th>}
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={12} className="muted">{error}</td></tr>}
              {!error && rows && shown.length === 0 && <tr><td colSpan={12} className="muted">No orders match this search.</td></tr>}
              {shown.map(r => (
                <tr key={r.id}>
                  <td className="check"><input type="checkbox" aria-label={`Select order ${r.id}`} checked={picked.has(r.id)} onChange={() => setPicked(prev => {
                    const next = new Set(prev)
                    next.has(r.id) ? next.delete(r.id) : next.add(r.id)
                    return next
                  })} /></td>
                  <td className="link">#{r.id}</td>
                  <td>{formatWhen(r.created_at)}</td>
                  <td>{r.customer}</td>
                  {cols.fulfill && <td className="muted">{r.fulfill_by || '—'}</td>}
                  {cols.channel && <td>{r.channel}</td>}
                  <td>{money(r.total)}</td>
                  {cols.payment && <td>{r.payment === 'paid' ? <Tag kind="quiet">Paid</Tag> : <Tag kind="pending">Payment pending</Tag>}</td>}
                  {cols.fulfillment && <td>{r.fulfillment === 'fulfilled' ? <Tag kind="quiet">Fulfilled</Tag> : <Tag kind="wait">Unfulfilled</Tag>}</td>}
                  {cols.items && <td>{r.items.toLocaleString()} items</td>}
                  {cols.delivery && <td className="muted">{r.delivery_status || '—'}</td>}
                  {cols.method && <td>{r.delivery_method}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/orders" target="_blank" rel="noreferrer">Learn more about orders</a>
      {creating && <OrderForm mode="order" onClose={() => setCreating(false)} onSaved={saved} />}
    </>
  )
}

function DraftsList() {
  const [rows, reload, error] = useJson('/api/drafts')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('desc')
  const [picked, setPicked] = useState(() => new Set())
  const [creating, setCreating] = useState(false)
  const headRef = useRef(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows || []).filter(r => {
      if (filter !== 'all' && r.status !== filter) return false
      if (!q) return true
      return [r.id, r.customer, r.po].join(' ').toLowerCase().includes(q)
    }).sort((a, b) => sort === 'asc' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  }, [rows, query, filter, sort])

  const allPicked = shown.length > 0 && shown.every(r => picked.has(r.id))
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = picked.size > 0 && !allPicked
  }, [picked, allPicked])

  return (
    <>
      <div className="orders-top">
        <h1>Drafts</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => csv([
            ['Draft order', 'PO number', 'Date', 'Customer', 'Status', 'Total'],
            ...shown.map(r => [r.id, r.po || '', formatWhen(r.created_at), r.customer, r.status, money(r.total)]),
          ])}>Export</button>
          <button type="button" className="solid" onClick={() => setCreating(true)}>Create order</button>
        </div>
      </div>
      <div className="sheet">
        <div className="toolbar">
          <select aria-label="Filter drafts" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="open">Open</option>
          </select>
          <label className="finder"><Search size={15} /><input placeholder="Search and filter" value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input ref={headRef} type="checkbox" aria-label="Select all drafts" checked={allPicked} onChange={e => setPicked(e.target.checked ? new Set(shown.map(r => r.id)) : new Set())} /></th>
                <th>Draft order</th>
                <th>PO number</th>
                <th><button type="button" className="sort" onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}>Date {sort === 'desc' ? '↓' : '↑'}</button></th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={7} className="muted">{error}</td></tr>}
              {!error && rows && shown.length === 0 && <tr><td colSpan={7} className="muted">No drafts match this search.</td></tr>}
              {shown.map(r => (
                <tr key={r.id}>
                  <td className="check"><input type="checkbox" aria-label={`Select draft ${r.id}`} checked={picked.has(r.id)} onChange={() => setPicked(prev => {
                    const next = new Set(prev)
                    next.has(r.id) ? next.delete(r.id) : next.add(r.id)
                    return next
                  })} /></td>
                  <td className="link">#{r.id}</td>
                  <td>{r.po ? <FileText size={15} aria-label="PO note" /> : ''}</td>
                  <td>{formatWhen(r.created_at)}</td>
                  <td>{r.customer}</td>
                  <td><Tag kind={r.status === 'open' ? 'open' : 'quiet'}>{r.status === 'open' ? 'Open' : 'Completed'}</Tag></td>
                  <td>{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/orders/create-orders" target="_blank" rel="noreferrer">Learn more about creating draft orders</a>
      {creating && <OrderForm mode="draft" onClose={() => setCreating(false)} onSaved={reload} />}
    </>
  )
}

function Checkouts() {
  const [scope, setScope] = useState('incomplete')
  const [review, setReview] = useState(false)
  const title = scope === 'recovered' ? 'Recovered checkouts will show here' : 'Abandoned checkouts will show here'
  return (
    <>
      <div className="orders-top">
        <h1>Abandoned checkouts</h1>
        <select className="ghost-select" aria-label="Checkout status" value={scope} onChange={e => setScope(e.target.value)}>
          <option value="incomplete">Incomplete</option>
          <option value="recovered">Recovered</option>
          <option value="all">All</option>
        </select>
      </div>
      <section className="panel empty-hero">
        <div>
          <h2>{title}</h2>
          <p>See when customers put an item in their cart but don't check out. You can also email customers a link to their cart.</p>
        </div>
        <CartMark />
      </section>
      <section className="panel recover">
        <h2>Recover sales with your abandoned checkout email</h2>
        <p>An automated email is already created for you. Take a moment to review the email and make any additional adjustments to the design, messaging, or recipient list.</p>
        <button type="button" className="ghost" onClick={() => setReview(true)}>Review email</button>
      </section>
      <a className="learn" href="https://help.shopify.com/en/manual/orders/abandoned-checkouts" target="_blank" rel="noreferrer">Learn more about abandoned checkouts</a>
      {review && (
        <Modal title="Abandoned checkout email" onClose={() => setReview(false)}>
          <div className="email">
            <p><span>Subject</span> You left something in your cart</p>
            <p>Hi there,</p>
            <p>You added items to your cart and didn't check out. They're still waiting — come back and finish your order.</p>
            <p className="email-btn">Return to cart</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="solid" onClick={() => setReview(false)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function CartMark() {
  return (
    <svg className="cart-mark" viewBox="0 0 120 90" aria-hidden="true">
      <rect x="8" y="18" width="78" height="58" rx="16" fill="#e7f6ef" />
      <path d="M28 38h34l-4 16H32z" fill="none" stroke="#1f8a4c" strokeWidth="2.4" />
      <circle cx="36" cy="62" r="3" fill="#1f8a4c" />
      <circle cx="54" cy="62" r="3" fill="#1f8a4c" />
      <circle cx="92" cy="28" r="16" fill="#fff" stroke="#e5262b" strokeWidth="2" />
      <path d="M86 22l12 12M98 22L86 34" stroke="#e5262b" strokeWidth="2" />
    </svg>
  )
}

export default function OrdersSection({ view, onChanged }) {
  if (view === 'drafts') return <DraftsList />
  if (view === 'checkouts') return <Checkouts />
  return <OrdersList onChanged={onChanged} />
}
