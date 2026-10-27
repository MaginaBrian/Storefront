import { useEffect, useState } from 'react'
import { Archive, AtSign, Check, ChevronDown, ChevronLeft, Copy, FileDown, FileSpreadsheet, Hash, Pencil, Smile, Trash2 } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'
import { CreatePurchaseOrder, PurchaseLines, RouteFields, lineFrom, lineTotal } from './CreateForms.jsx'
import { EmptyCatalog, PoMark } from './ui.jsx'

const STORE = {
  name: 'Maison',
  email: 'hello@maison.co.ke',
  address: ['Nairobi', 'Nairobi', '00100', 'Kenya'],
}

function longDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function dayLabel(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (date.toDateString() === new Date().toDateString()) return 'Today'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function clock(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (Date.now() - date.getTime() < 60_000) return 'Just now'
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function linesOf(order) {
  try {
    const parsed = JSON.parse(order.lines || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function commentsOf(order) {
  try {
    const parsed = JSON.parse(order.comments || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function PurchaseOrderDetail({ id, created, onOpen, onChanged }) {
  const [inventory] = useJson('/api/inventory')
  const [transfers] = useJson('/api/transfers')
  const [order, setOrder] = useState(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(created ? { text: 'Purchase order created' } : null)
  const [menu, setMenu] = useState('')
  const [editingRoute, setEditingRoute] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [comment, setComment] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    let ignore = false
    setOrder(null)
    setMissing(false)
    fetch(`/api/purchase-orders/${id}`).then(async response => {
      const body = await response.json()
      if (ignore) return
      if (!response.ok) { setMissing(true); return }
      setOrder(body)
      setTags(body.tags || '')
    }).catch(() => { if (!ignore) setMissing(true) })
    return () => { ignore = true }
  }, [id])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!menu) return undefined
    const close = () => setMenu('')
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const act = (action, extra = {}) => {
    setBusy(true)
    setError('')
    return fetch(`/api/purchase-orders/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not update the purchase order')
      return body
    }).catch(err => { setError(err.message); throw err }).finally(() => setBusy(false))
  }

  if (missing) {
    return (
      <section className="panel">
        <h2>Purchase order</h2>
        <p>This purchase order is not saved.</p>
        <button type="button" className="ghost" onClick={() => onOpen('purchase-orders')}>All purchase orders</button>
      </section>
    )
  }
  if (!order) return <p className="muted">Loading purchase order…</p>

  const lines = linesOf(order)
  const units = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const ordered = order.status === 'ordered'
  const draft = order.status === 'draft'
  const skuFor = line => line.supplier_sku || line.sku || ''
  const saveLines = next => act('lines', { lines: next }).then(body => { setOrder(body); onChanged() }).catch(() => {})
  const update = fields => act('update', fields).then(body => { setOrder(body); onChanged(); return body }).catch(() => {})
  const downloadCsv = () => csv([
    ['Purchase order', 'Date', 'Supplier', 'Ship to', 'Status', 'Product', 'Variant', 'SKU', 'Qty', 'Cost', 'Tax', 'Total', 'Reference', 'Notes', 'Terms', 'Currency'],
    ...lines.map(line => {
      const [product, variant = ''] = String(line.title || '').split(' · ')
      return [
        `#PO${order.id}`, longDate(order.created_at), order.supplier, order.destination || 'Nairobi',
        'Ordered', product, variant, skuFor(line), line.qty, money(line.price || 0), '0%', money(lineTotal(line)),
        order.reference || '', order.note || '', order.terms || 'None', order.currency || 'KES',
      ]
    }),
  ], `purchase-order-${order.id}.csv`)
  const events = [
    { kind: 'event', body: 'You created this purchase order.', created_at: order.created_at },
    ...commentsOf(order).map(item => ({ kind: 'comment', body: item.body, created_at: item.created_at })),
  ]
  let lastDay = ''

  return (
    <div className="order-page">
      <div className="po-top no-print">
        <button type="button" className="icon-btn" aria-label="Purchase orders" onClick={() => onOpen('purchase-orders')}><ChevronLeft size={18} /></button>
        <div className="po-top-mid">
          {toast && (
            <div className={`save-bar ${toast.ok ? 'ok' : ''}`} role="status">
              {toast.ok && <Check size={16} />}
              <span>{toast.text}</span>
            </div>
          )}
        </div>
        <div className="po-actions">
          {draft && <button type="button" className="ghost" disabled={busy} onClick={() => act('delete').then(() => { onChanged(); onOpen('purchase-orders') }).catch(() => {})}>Delete</button>}
          {ordered && (
            <div className="menu" onClick={e => e.stopPropagation()}>
              <button type="button" className="ghost" onClick={() => setMenu(menu === 'link' ? '' : 'link')}>Link transfer</button>
              {menu === 'link' && (
                <div className="menu-pop">
                  {(transfers || []).map(transfer => (
                    <button
                      type="button"
                      key={transfer.id}
                      onClick={() => {
                        setMenu('')
                        fetch(`/api/transfers/${transfer.id}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'link', purchase_order: order.id }),
                        }).then(() => onOpen('transfers', { transfer: transfer.id }))
                      }}
                    >
                      #{transfer.id} · {transfer.origin} → {transfer.destination}
                    </button>
                  ))}
                  {transfers && transfers.length === 0 && <p className="muted">No transfers to link.</p>}
                </div>
              )}
            </div>
          )}
          <div className="menu" onClick={e => e.stopPropagation()}>
            <button type="button" className="ghost" onClick={() => setMenu(menu === 'more' ? '' : 'more')}>More actions <ChevronDown size={14} /></button>
            {menu === 'more' && (
              <div className="menu-pop">
                {ordered && <button type="button" onClick={() => { setMenu(''); window.print() }}><FileDown size={15} /> Export PDF</button>}
                {ordered && <button type="button" onClick={() => { setMenu(''); downloadCsv() }}><FileSpreadsheet size={15} /> Export CSV</button>}
                <button type="button" onClick={() => act('duplicate').then(body => { onChanged(); onOpen('purchase-orders', { po: body.id }) }).catch(() => {})}><Copy size={15} /> Duplicate</button>
                {order.status !== 'archived' && <button type="button" onClick={() => act('archive').then(() => { onChanged(); onOpen('purchase-orders') }).catch(() => {})}><Archive size={15} /> Archive</button>}
                <button type="button" className="danger" onClick={() => act('delete').then(() => { onChanged(); onOpen('purchase-orders') }).catch(() => {})}><Trash2 size={15} /> Delete purchase order</button>
              </div>
            )}
          </div>
          {draft && <button type="button" className="solid" disabled={busy} onClick={() => act('order').then(body => { setOrder(body); setToast({ text: 'Marked as ordered', ok: true }); onChanged() }).catch(() => {})}>{busy ? 'Saving…' : 'Mark as ordered'}</button>}
          {ordered && <button type="button" className="solid" onClick={() => onOpen('transfers', { create: '1', po: order.id })}>Create transfer</button>}
        </div>
      </div>
      <div className="po-heading no-print">
        <h1>#PO{order.id}</h1>
        <span className={`tag ${ordered ? 'done' : 'open'}`}>{ordered ? 'Ordered' : draft ? 'Draft' : 'Archived'}</span>
      </div>
      {error && <p className="form-error no-print">{error}</p>}
      <div className="order-grid no-print">
        <div>
          <section className="detail-card po-card">
            <RouteFields
              supplier={order.supplier}
              destination={order.destination}
              locked={ordered && !editingRoute}
              onEdit={() => setEditingRoute(true)}
              onDone={editingRoute ? () => setEditingRoute(false) : undefined}
              onSupplier={value => update({ supplier: value })}
              onDestination={value => update({ destination: value })}
            />
            <PurchaseLines
              inventory={inventory}
              lines={lines}
              destination={order.destination}
              locked={!draft}
              onAdd={items => {
                const incoming = (Array.isArray(items) ? items : [items]).filter(item => !lines.some(line => line.inventory_id === item.id))
                if (incoming.length) saveLines([...lines, ...incoming.map(lineFrom)])
              }}
              onChange={next => saveLines(lines.map(line => line.inventory_id === next.inventory_id ? next : line))}
              onRemove={itemId => saveLines(lines.filter(line => line.inventory_id !== itemId))}
            />
          </section>
          <section className="detail-card">
            <h2 className="timeline-title">Timeline</h2>
            <div className="composer">
              <span className="avatar" aria-hidden="true">MA</span>
              <textarea aria-label="Leave a comment" value={comment} onChange={e => setComment(e.target.value)} placeholder="Leave a comment…" />
              <div className="composer-tools">
                <button type="button" aria-label="Emoji" onClick={() => setComment(value => `${value}:)`)}><Smile size={15} /></button>
                <button type="button" aria-label="Mention" onClick={() => setComment(value => `${value}@`)}><AtSign size={15} /></button>
                <button type="button" aria-label="Reference" onClick={() => setComment(value => `${value}#`)}><Hash size={15} /></button>
                <button type="button" className="ghost" disabled={busy || !comment.trim()} onClick={() => act('comment', { body: comment.trim() }).then(body => { setOrder(body); setComment(''); onChanged() }).catch(() => {})}>Post</button>
              </div>
            </div>
            <p className="staff-note">Only you and other staff can see comments</p>
            <ul className="timeline">
              {events.map(event => {
                const day = dayLabel(event.created_at)
                const showDay = day !== lastDay
                lastDay = day
                return (
                  <li key={`${event.kind}-${event.created_at}-${event.body}`}>
                    {showDay && <p className="day">{day}</p>}
                    <div className={`event ${event.kind}`}>
                      {event.kind === 'comment' ? <span className="avatar sm">MA</span> : <i />}
                      <p>{event.body}</p>
                      <time>{clock(event.created_at)}</time>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <div className="card-title">
              <h2>Cost summary</h2>
            </div>
            <table className="money-table">
              <tbody>
                <tr><td>Order details</td><td className="muted">{lines.length} variants ({units} items)</td><td>{money(total)}</td></tr>
                <tr><td>Taxes (Included)</td><td /><td>KES 0.00</td></tr>
                <tr className="total-row"><td>Total</td><td /><td>{money(total)}</td></tr>
              </tbody>
            </table>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h2>Purchase order details</h2>
              <button type="button" className="icon-btn" aria-label="Edit purchase order details" onClick={() => setEditingDetails(open => !open)}><Pencil size={15} /></button>
            </div>
            <p className="detail-line"><span>Date created</span><b>{(order.created_at || '').slice(0, 10)}</b></p>
            {editingDetails ? (
              <>
                <label className="field">Reference number
                  <input aria-label="Reference number" defaultValue={order.reference || ''} maxLength={255} onBlur={e => update({ reference: e.target.value })} />
                </label>
                <label className="field">Note to supplier
                  <textarea aria-label="Note to supplier" defaultValue={order.note || ''} maxLength={5000} onBlur={e => update({ note: e.target.value })} />
                </label>
                <div className="terms-row">
                  <span>Terms</span>
                  <select aria-label="Terms" defaultValue={order.terms || ''} onChange={e => update({ terms: e.target.value })}>
                    <option value="">None</option>
                    <option>Due on receipt</option>
                    <option>Net 30</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <p className="detail-line"><span>Reference number</span><b>{order.reference || 'None'}</b></p>
                <p className="detail-line"><span>Note to supplier</span><b>{order.note || 'None'}</b></p>
                <div className="terms-row">
                  <span>Terms</span><b>{order.terms || 'None'}</b>
                  <span>Currency</span><b>{order.currency || 'KES'}</b>
                </div>
              </>
            )}
          </section>
          <section className="detail-card">
            <h2>Tags</h2>
            <input aria-label="Tags" value={tags} maxLength={40} onChange={e => setTags(e.target.value)} onBlur={() => { if (tags !== (order.tags || '')) update({ tags }) }} />
            <small className="muted">{tags.length}/40</small>
          </section>
        </aside>
      </div>
      <article className="po-sheet print-only">
        <header className="po-brand">
          <strong>{STORE.name}</strong>
          <div>
            <b>#PO{order.id}</b>
            <span>{longDate(order.created_at)}</span>
          </div>
        </header>
        <h1>{STORE.name}</h1>
        <div className="po-parties">
          <section>
            <h2>Supplier</h2>
            <p>{order.supplier}</p>
          </section>
          <section>
            <h2>Ship to</h2>
            {(order.destination ? [order.destination, ...STORE.address.slice(1)] : STORE.address).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </section>
          <section>
            <h2>Bill to</h2>
            {STORE.address.map(line => <p key={line}>{line}</p>)}
          </section>
        </div>
        <div className="po-parties">
          <section><h2>Payment terms</h2><p>{order.terms || 'None'}</p></section>
          <section><h2>Supplier currency</h2><p>{order.currency || 'KES'}</p></section>
          <section><h2>Estimated arrival</h2><p>—</p></section>
        </div>
        <table>
          <thead>
            <tr><th>Products</th><th>Supplier SKU</th><th>Qty</th><th>Cost</th><th>Tax</th><th>Total (KES)</th></tr>
          </thead>
          <tbody>
            {lines.map(line => {
              const [product, variant = ''] = String(line.title || '').split(' · ')
              return (
                <tr key={`${line.inventory_id}-${line.title}`}>
                  <td>{product}{variant && <span>{variant}</span>}</td>
                  <td>{skuFor(line)}</td>
                  <td>{line.qty}</td>
                  <td>{money(line.price || 0)}</td>
                  <td>0%</td>
                  <td>{money(lineTotal(line))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="po-summary">
          <div>
            <h2>Reference number</h2>
            <p>{order.reference || ''}</p>
            <h2>Notes to supplier</h2>
            <p>{order.note || ''}</p>
          </div>
          <div>
            <h2>Cost summary</h2>
            <p><span>Taxes (included)</span><b>KES 0.00</b></p>
            <p><span>Subtotal ({units} {units === 1 ? 'item' : 'items'})</span><b>{money(total)}</b></p>
            <p className="po-total"><span>Total</span><b>{money(total)}</b></p>
          </div>
        </div>
        <footer>
          <div>
            <strong>{STORE.name}</strong>
            <span>Nairobi</span>
            <span>{STORE.email}</span>
          </div>
          <span>1 of 1</span>
        </footer>
      </article>
    </div>
  )
}

export function PurchaseOrders({ onOpen, focus = {} }) {
  const [rows, reload] = useJson('/api/purchase-orders')
  if (focus.create === '1') return <CreatePurchaseOrder onOpen={onOpen} onSaved={reload} />
  if (focus.po) return <PurchaseOrderDetail key={focus.po} id={focus.po} created={focus.notice === 'created'} onOpen={onOpen} onChanged={reload} />
  if (!rows) return <p className="muted">Loading purchase orders…</p>
  const visible = rows.filter(row => row.status !== 'archived')
  if (visible.length === 0) {
    return (
      <EmptyCatalog
        title="Purchase orders"
        heading="Manage your purchase orders"
        text="Track and receive inventory ordered from suppliers."
        learn="Learn more about purchase orders"
        href="https://help.shopify.com/en/manual/products/inventory/purchase-orders"
        onAction={() => onOpen('purchase-orders', { create: '1' })}
        mark={<PoMark />}
      />
    )
  }
  return (
    <>
      <div className="orders-top">
        <h1>Purchase orders</h1>
        <button type="button" className="solid" onClick={() => onOpen('purchase-orders', { create: '1' })}>Create purchase order</button>
      </div>
      <div className="sheet">
        <table>
          <thead><tr><th>Purchase order</th><th>Supplier</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.id} className="clickable" onClick={() => onOpen('purchase-orders', { po: r.id })}>
                <td><button type="button" className="text-link">#PO{r.id}</button></td>
                <td>{r.supplier}</td>
                <td>{r.status === 'ordered' ? 'Ordered' : 'Draft'}</td>
                <td>{r.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
