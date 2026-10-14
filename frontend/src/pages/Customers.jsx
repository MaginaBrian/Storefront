import { useEffect, useState } from 'react'
import { useApi } from '../lib/api.js'
import { money } from '../lib/money.js'
import { Sheet } from './ui.jsx'

function activityLabel(iso) {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Customers({ focus = {}, onOpen }) {
  const [profile, setProfile] = useState(null)
  const [rows] = useApi('/api/customers')
  const [segment, setSegment] = useState(null)
  const [segmentRows, setSegmentRows] = useState(null)
  useEffect(() => {
    if (!focus.customer) { setProfile(null); return }
    let ignore = false
    setProfile(null)
    fetch(`/api/profile?customer=${encodeURIComponent(focus.customer)}`).then(r => r.json()).then(data => {
      if (!ignore) setProfile(data)
    })
    return () => { ignore = true }
  }, [focus.customer])
  useEffect(() => {
    if (!focus.segment) { setSegment(null); setSegmentRows(null); return }
    let ignore = false
    fetch(`/api/segments/${focus.segment}`).then(r => r.json()).then(data => {
      if (ignore) return
      setSegment(data.segment || null)
      setSegmentRows(data.customers || [])
    })
    return () => { ignore = true }
  }, [focus.segment])
  const person = profile?.customer
  const detail = !profile
    ? 'Loading profile…'
    : person
      ? `${person.email || 'No email'} · ${person.location} · ${person.orders} orders · ${money(person.spent)} spent`
      : 'No saved profile for this name yet.'
  return (
    <>
      {segment && (
        <section className="handoff">
          <div>
            <h2>{segment.name}</h2>
            <p>{segment.percent}% of customers · Created on {activityLabel(segment.last_activity)} · {segment.created_by}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('segments')}>All segments</button>
        </section>
      )}
      {focus.customer && (
        <section className="handoff">
          <div>
            <h2>{focus.customer}</h2>
            <p>{detail}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('orders', { customer: focus.customer })}>View orders</button>
        </section>
      )}
      {profile?.orders?.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Orders</h3>
          <table>
            <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Fulfillment</th></tr></thead>
            <tbody>
              {profile.orders.map(o => (
                <tr key={o.id}>
                  <td><button type="button" className="text-link" onClick={() => onOpen('orders', { order: o.id })}>#{o.id}</button></td>
                  <td>{o.created_at.slice(0, 10)}</td>
                  <td>{money(o.total)}</td>
                  <td>{o.payment}</td>
                  <td>{o.fulfillment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {profile?.drafts?.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Drafts</h3>
          <table>
            <thead><tr><th>Draft</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {profile.drafts.map(d => (
                <tr key={d.id}>
                  <td><button type="button" className="text-link" onClick={() => onOpen('drafts', { draft: d.id })}>#{d.id}</button></td>
                  <td>{d.created_at.slice(0, 10)}</td>
                  <td>{money(d.total)}</td>
                  <td>{d.status}{d.order_id ? ` · order #${d.order_id}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet title="Customers" rows={focus.segment ? segmentRows : rows} empty={focus.segment ? 'No customers in this segment.' : 'No customers yet.'} picked={r => r.name === focus.customer} columns={[
        { key: 'name', label: 'Customer', render: r => <button type="button" className="text-link" onClick={() => onOpen('customers', { customer: r.name })}>{r.name}</button> },
        { key: 'email', label: 'Email', render: r => r.email || '—' },
        { key: 'location', label: 'Location' },
        { key: 'orders', label: 'Orders' },
        { key: 'spent', label: 'Spent', render: r => money(r.spent) },
      ]} />
    </>
  )
}
