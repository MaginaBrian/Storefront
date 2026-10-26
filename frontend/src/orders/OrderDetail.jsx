import { useEffect, useRef, useState } from 'react'
import { AtSign, ChevronDown, Hash, Link2, Package, Pencil, Plus, Smile, Truck, X } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { Tag } from '../components/Tag.jsx'
import { money } from '../lib/money.js'
import { clock, dayLabel, longWhen } from './time.js'

function EventText({ event, onOpen }) {
  if (!event.draft_id) return event.body
  const token = `#${event.draft_id}`
  const [before, after] = event.body.split(token)
  if (after === undefined) return event.body
  return <>{before}<button type="button" className="text-link" onClick={() => onOpen('drafts', { draft: event.draft_id })}>{token}</button>{after}</>
}

export default function OrderDetail({ orderId, onOpen, onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [tagging, setTagging] = useState(false)
  const [tag, setTag] = useState('')
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    let ignore = false
    setData(null)
    setError('')
    fetch(`/api/orders/${orderId}`).then(async r => {
      if (!r.ok) throw new Error('missing')
      return r.json()
    }).then(d => { if (!ignore) setData(d) }).catch(() => { if (!ignore) setError('This order is not in the store.') })
    return () => { ignore = true }
  }, [orderId])

  useEffect(() => {
    if (!menu) return
    const close = e => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const act = (action, extra = {}) => {
    setBusy(true)
    setNotice('')
    return fetch(`/api/orders/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    }).then(async r => {
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Could not update this order')
      setData(body)
      if (action === 'fulfill' || action === 'pay') onChanged?.()
      return body
    }).finally(() => setBusy(false))
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Order #{orderId}</h2>
        <p>{error}</p>
        <button type="button" className="ghost" onClick={() => onOpen('orders')}>Back to orders</button>
      </section>
    )
  }
  if (!data) return <p className="muted">Loading order…</p>

  const { order, lines, address, customer, tags, events, summary } = data
  const paid = order.payment === 'paid'
  const fulfilled = order.fulfillment === 'fulfilled'
  const mapQuery = address ? [address.line, address.city, address.country].filter(Boolean).join(', ') : ''
  let lastDay = ''

  const saveEdit = async form => {
    const next = Object.fromEntries(new FormData(form))
    await act('note', { note: next.note })
    await act('address', { line: next.line, city: next.city, country: next.country })
    setEditing(false)
  }

  return (
    <div className="order-page">
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('orders')}>Orders</button>
        <span>/</span>
        <span>#{order.id}</span>
      </div>
      <div className="order-head">
        <div>
          <div className="order-title">
            <h1>#{order.id}</h1>
            <Tag kind={paid ? 'quiet' : 'pending'}>{paid ? 'Paid' : 'Payment pending'}</Tag>
            <Tag kind={fulfilled ? 'quiet' : 'wait'}>{fulfilled ? 'Fulfilled' : 'Unfulfilled'}</Tag>
          </div>
          <p className="order-sub">
            {longWhen(order.created_at)} from{' '}
            <button type="button" className="text-link" onClick={() => onOpen('orders', { channel: order.channel })}>{order.channel}</button>
          </p>
        </div>
        <div className="orders-actions">
          <button type="button" className="ghost" disabled={busy} onClick={() => act('restock').then(() => setNotice('Unfulfilled items restocked.'))}>Restock</button>
          <button type="button" className="ghost" onClick={() => setEditing(true)}>Edit</button>
          <div className="menu" ref={menuRef}>
            <button type="button" className="ghost" aria-expanded={menu} onClick={() => setMenu(o => !o)}>More actions <ChevronDown size={14} /></button>
            {menu && (
              <div className="popover menu-pop">
                <button type="button" onClick={() => { setMenu(false); window.print() }}>Print order</button>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(order.confirmation || ''); setNotice(`Confirmation ${order.confirmation} copied.`); setMenu(false) }}>Copy confirmation</button>
                <button type="button" onClick={() => { setMenu(false); act('invoice').then(() => setNotice(`Invoice sent to ${order.customer}.`)) }}>Send invoice</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {notice && <p className="notice">{notice}</p>}
      <div className="order-grid">
        <div>
          <section className="detail-card">
            <div className="card-title">
              <span className={`badge-icon ${fulfilled ? 'done' : 'wait'}`}><Package size={16} /></span>
              <h2>{fulfilled ? 'Fulfilled' : 'Unfulfilled'}</h2>
              {!fulfilled && <button type="button" className="solid" disabled={busy} onClick={() => act('fulfill')}>Mark as fulfilled</button>}
            </div>
            <p className="ship-line"><Truck size={15} /> {order.delivery_method || 'Shipping'}</p>
            {lines.map(line => {
              const exact = line.price * line.qty === line.line_total
              const detail = [line.size ? `Size ${line.size}` : '', line.color || ''].filter(Boolean).join(' · ')
              const amount = exact ? `${money(line.price)} × ${line.qty.toLocaleString()}` : `${line.qty.toLocaleString()} items`
              return (
                <div className="line-row" key={line.id}>
                  <input type="checkbox" defaultChecked aria-label={line.title} />
                  <strong>{line.title}</strong>
                  <span className="muted">{detail ? `${detail} · ${amount}` : amount}</span>
                  <b>{money(line.line_total)}</b>
                </div>
              )
            })}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <span className={`badge-icon ${paid ? 'done' : 'pay'}`}><span className="pay-dot" /></span>
              <h2>{paid ? 'Paid' : 'Payment pending'}</h2>
              {!paid && (
                <div className="orders-actions">
                  <button type="button" className="ghost" disabled={busy} onClick={() => act('invoice').then(() => setNotice(`Invoice sent to ${order.customer}.`))}>Send invoice</button>
                  <button type="button" className="solid" disabled={busy} onClick={() => act('pay')}>Mark as paid</button>
                </div>
              )}
            </div>
          </section>
          <section className="detail-card">
            <table className="money-table">
              <tbody>
                <tr><td>Subtotal</td><td className="muted">{summary.items.toLocaleString()} items</td><td>{money(summary.subtotal)}</td></tr>
                <tr><td>Taxes</td><td className="muted">{money(summary.tax)} · {summary.tax_label}</td><td>Included</td></tr>
                <tr className="total-row"><td>Total</td><td /><td>{money(summary.total)}</td></tr>
                <tr><td>Paid</td><td /><td>{money(summary.paid)}</td></tr>
                <tr><td>Balance</td><td className="muted">{summary.balance_note}</td><td>{money(summary.balance)}</td></tr>
              </tbody>
            </table>
          </section>
          <section className="detail-card">
            <h2 className="timeline-title">Timeline</h2>
            <div className="composer">
              <span className="avatar" aria-hidden="true">MA</span>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Leave a comment…" />
              <div className="composer-tools">
                <button type="button" aria-label="Emoji" onClick={() => setComment(c => `${c}:)`)}><Smile size={15} /></button>
                <button type="button" aria-label="Mention" onClick={() => setComment(c => `${c}@`)}><AtSign size={15} /></button>
                <button type="button" aria-label="Order reference" onClick={() => setComment(c => `${c}#`)}><Hash size={15} /></button>
                <button type="button" aria-label="Link" onClick={() => setComment(c => `${c}https://`)}><Link2 size={15} /></button>
                <button type="button" className="ghost" disabled={busy || !comment.trim()} onClick={() => act('comment', { body: comment.trim() }).then(() => setComment(''))}>Post</button>
              </div>
            </div>
            <p className="staff-note">Only you and other staff can see comments</p>
            <ul className="timeline">
              {events.map(event => {
                const day = dayLabel(event.created_at)
                const showDay = day !== lastDay
                lastDay = day
                return (
                  <li key={event.id}>
                    {showDay && <p className="day">{day}</p>}
                    <div className={`event ${event.kind}`}>
                      {event.kind === 'comment' ? <span className="avatar sm">MA</span> : <i />}
                      <p><EventText event={event} onOpen={onOpen} /></p>
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
              <h2>Notes</h2>
              <button type="button" className="icon-btn" aria-label="Add note" onClick={() => { setNote(order.note || ''); setNoting(true) }}><Plus size={16} /></button>
            </div>
            {order.note && !noting && <p>{order.note}</p>}
            {noting && (
              <form onSubmit={e => { e.preventDefault(); act('note', { note }).then(() => setNoting(false)) }}>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note" />
                <div className="orders-actions">
                  <button type="button" className="ghost" onClick={() => setNoting(false)}>Cancel</button>
                  <button type="submit" className="solid" disabled={busy}>Save</button>
                </div>
              </form>
            )}
          </section>
          <section className="detail-card">
            <h2>Customer</h2>
            <button type="button" className="text-link" onClick={() => onOpen('customers', { customer: customer.name })}>{customer.name}</button>
            <button type="button" className="quiet-link" onClick={() => onOpen('orders', { customer: customer.name })}>{customer.orders} {customer.orders === 1 ? 'order' : 'orders'}</button>
          </section>
          <section className="detail-card">
            <h2>Shipping address</h2>
            {address ? (
              <address>
                {address.name}<br />
                {address.line && <>{address.line}<br /></>}
                {address.city}<br />
                {address.country}
              </address>
            ) : <p className="muted">No shipping address</p>}
            {mapQuery && <a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer">View map</a>}
          </section>
          <section className="detail-card">
            <h2>Billing address</h2>
            <p>{address?.billing_same ? 'Same as shipping address' : 'No billing address'}</p>
          </section>
          <section className="detail-card">
            <h2>Conversion summary</h2>
            <p className="muted">There aren't any conversion details available for this order.</p>
            <a className="text-link" href="https://help.shopify.com/en/manual/orders" target="_blank" rel="noreferrer">Learn more</a>
          </section>
          <section className="detail-card">
            <h2>Order risk</h2>
            <p className="muted">Analysis not available</p>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h2>Tags</h2>
              <button type="button" className="icon-btn" aria-label="Edit tags" onClick={() => setTagging(o => !o)}><Pencil size={15} /></button>
            </div>
            <div className="tag-list">
              {tags.map(item => (
                <button type="button" key={item} className="chip" onClick={() => act('tag', { tag: item, remove: true })}>{item} <X size={12} /></button>
              ))}
            </div>
            {tagging && (
              <form className="tag-form" onSubmit={e => { e.preventDefault(); if (!tag.trim()) return; act('tag', { tag: tag.trim() }).then(() => { setTag(''); setTagging(false) }) }}>
                <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Add a tag" autoFocus />
                <button type="submit" className="solid" disabled={busy}>Add</button>
              </form>
            )}
          </section>
        </aside>
      </div>
      {editing && (
        <Modal title={`Edit order #${order.id}`} onClose={() => setEditing(false)}>
          <form className="modal-form" onSubmit={e => { e.preventDefault(); saveEdit(e.currentTarget) }}>
            <label>Note<textarea name="note" defaultValue={order.note || ''} rows={3} /></label>
            <label>Street<input name="line" defaultValue={address?.line || ''} /></label>
            <label>City<input name="city" defaultValue={address?.city || ''} /></label>
            <label>Country<input name="country" defaultValue={address?.country || 'Kenya'} /></label>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="solid" disabled={busy}>Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
