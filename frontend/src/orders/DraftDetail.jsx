import { useEffect, useRef, useState } from 'react'
import { AtSign, ChevronDown, CircleCheck, Hash, Link2, MapPin, Smile } from 'lucide-react'
import { money } from '../lib/money.js'
import { bannerWhen, clock, dayLabel, updatedWhen } from './time.js'

function DraftEventText({ event, onOpen }) {
  if (!event.order_id) return event.body
  const token = `#${event.order_id}`
  const [before, after] = event.body.split(token)
  if (after === undefined) return event.body
  return <>{before}<button type="button" className="text-link" onClick={() => onOpen('orders', { order: event.order_id })}>{token}</button>{after}</>
}

export default function DraftDetail({ draftId, onOpen }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    let ignore = false
    setData(null)
    setError('')
    fetch(`/api/drafts/${encodeURIComponent(draftId)}`).then(async r => {
      if (!r.ok) throw new Error('missing')
      return r.json()
    }).then(d => { if (!ignore) setData(d) }).catch(() => { if (!ignore) setError('This draft is not in the store.') })
    return () => { ignore = true }
  }, [draftId])

  useEffect(() => {
    if (!menu) return
    const close = e => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const act = (action, extra = {}) => {
    setBusy(true)
    return fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    }).then(async r => {
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Could not update this draft')
      if (body.draft) setData(body)
      return body
    }).finally(() => setBusy(false))
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Draft #{draftId}</h2>
        <p>{error}</p>
        <button type="button" className="ghost" onClick={() => onOpen('drafts')}>Back to drafts</button>
      </section>
    )
  }
  if (!data) return <p className="muted">Loading draft…</p>

  const { draft, lines, address, customer, events, summary, market, currency } = data
  const mapQuery = [address?.line, address?.city, address?.country].filter(Boolean).join(', ')
  let lastDay = ''

  return (
    <div className="order-page">
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('drafts')}>Drafts</button>
        <span>/</span>
        <span>#{draft.id}</span>
      </div>
      <div className="order-head">
        <div>
          <div className="order-title"><h1>#{draft.id}</h1></div>
          <p className="order-sub">{updatedWhen(draft.created_at)}</p>
        </div>
        <div className="orders-actions">
          <button type="button" className="ghost" disabled={busy} onClick={() => act('duplicate').then(d => onOpen('drafts', { draft: d.draft.id }))}>Duplicate</button>
          <div className="menu" ref={menuRef}>
            <button type="button" className="ghost icon-only" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu(o => !o)}><ChevronDown size={16} /></button>
            {menu && (
              <div className="popover menu-pop">
                <button type="button" onClick={() => { setMenu(false); window.print() }}>Print draft</button>
                {draft.status === 'open' && <button type="button" onClick={() => { setMenu(false); act('invoice').then(() => onOpen('drafts', { draft: draft.id, invoice: '1' })) }}>Send invoice</button>}
                {draft.status === 'open' && <button type="button" onClick={() => { setMenu(false); act('order', { payment: 'paid' }).then(d => onOpen('orders', { order: d.order_id })) }}>Mark as paid</button>}
                <button type="button" onClick={() => { setMenu(false); act('order').then(d => onOpen('orders', { order: d.order_id })) }}>Create order</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {draft.status === 'completed' && draft.order_id && (
        <p className="done-banner">
          <CircleCheck size={18} />
          <span>
            <strong>Completed</strong>
            {' '}Order created on {bannerWhen(draft.created_at)}. You can{' '}
            <button type="button" onClick={() => onOpen('orders', { order: draft.order_id })}>view the order</button>
            {' '}or{' '}
            <button type="button" disabled={busy} onClick={() => act('order').then(d => onOpen('orders', { order: d.order_id }))}>create a new order</button>.
          </span>
        </p>
      )}
      <div className="order-grid">
        <div>
          <h2 className="section-label">Products</h2>
          <section className="detail-card">
            {lines.map(line => {
              const exact = line.price * line.qty === line.line_total
              return (
                <div className="line-row" key={line.id}>
                  <input type="checkbox" defaultChecked aria-label={line.title} />
                  <strong>{line.title}</strong>
                  <span className="muted">{exact ? `${money(line.price)} × ${line.qty.toLocaleString()}` : `${line.qty.toLocaleString()} items`}</span>
                  <b>{money(line.line_total)}</b>
                </div>
              )
            })}
          </section>
          <h2 className="section-label">Payment</h2>
          <section className="detail-card">
            <table className="money-table">
              <tbody>
                <tr><td>Subtotal</td><td className="muted">{summary.items.toLocaleString()} items</td><td>{money(summary.subtotal)}</td></tr>
                <tr><td>Discount</td><td className="muted">—</td><td>{money(summary.discount)}</td></tr>
                <tr><td>Shipping</td><td className="muted">—</td><td>{money(summary.shipping)}</td></tr>
                <tr><td>Estimated tax</td><td className="muted">{money(summary.tax)} · {summary.tax_label}</td><td>Included</td></tr>
                <tr className="total-row"><td>Total</td><td /><td>{money(summary.total)}</td></tr>
              </tbody>
            </table>
          </section>
          <p className="due-note">{summary.due_note}</p>
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
                      <p><DraftEventText event={event} onOpen={onOpen} /></p>
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
            <h2>Customer</h2>
            <button type="button" className="text-link" onClick={() => onOpen('customers', { customer: customer.name })}>{customer.name}</button>
            <button type="button" className="quiet-link" onClick={() => onOpen('orders', { customer: customer.name })}>{customer.orders} {customer.orders === 1 ? 'order' : 'orders'}</button>
          </section>
          <section className="detail-card">
            <h2>Shipping address</h2>
            <address>
              {address.name}<br />
              {address.line && <>{address.line}<br /></>}
              {address.city}<br />
              {address.country}
            </address>
            {mapQuery && <a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer">View map</a>}
          </section>
          <section className="detail-card">
            <h2>Billing address</h2>
            <p>{address.billing_same ? 'Same as shipping address' : 'No billing address'}</p>
          </section>
          <section className="detail-card">
            <h2>Markets</h2>
            <span className="market-pill"><MapPin size={14} /> {market}</span>
          </section>
          <section className="detail-card">
            <h2>Currency</h2>
            <select className="currency-select" aria-label="Currency" defaultValue={currency}>
              <option>{currency}</option>
            </select>
          </section>
        </aside>
      </div>
    </div>
  )
}
