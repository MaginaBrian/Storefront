import { useApi } from '../lib/api.js'
import { money } from '../lib/money.js'

function ChannelOrders({ channel, onOpen }) {
  const [orders] = useApi('/api/orders')
  const rows = orders?.filter(o => o.channel === channel) || []
  return (
    <div className="card">
      <h3>Orders from {channel}</h3>
      {rows.length === 0 && <p className="muted">No recorded orders for {channel} yet.</p>}
      {rows.length > 0 && (
        <table>
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th></tr></thead>
          <tbody>
            {rows.map(o => (
              <tr key={o.id}>
                <td><button type="button" className="text-link" onClick={() => onOpen('orders', { order: o.id })}>#{o.id}</button></td>
                <td><button type="button" className="text-link" onClick={() => onOpen('customers', { customer: o.customer })}>{o.customer}</button></td>
                <td>{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function StorePage({ onOpen }) {
  const [store] = useApi('/api/store')
  if (!store) return null
  return (
    <>
      <h1 className="title">Online Store</h1>
      <section className="kpis">
        {[['Domain', store.domain], ['Theme', store.theme], ['Status', store.status]].map(([k, v]) => (
          <div className="card kpi" key={k}><span className="muted">{k}</span><strong className="store-val">{v}</strong></div>
        ))}
      </section>
      <ChannelOrders channel="Online Store" onOpen={onOpen} />
    </>
  )
}

export function AgenticPage({ onOpen }) {
  const [row] = useApi('/api/agentic')
  if (!row) return null
  const rate = Math.round((row.resolved / row.conversations) * 100)
  return (
    <>
      <h1 className="title">Agentic</h1>
      <section className="kpis">
        {[['Conversations', row.conversations], ['Resolved', row.resolved], ['Handed off', row.handoff], ['Resolution', `${rate}%`]].map(([k, v]) => (
          <div className="card kpi" key={k}><span className="muted">{k}</span><strong className="store-val">{v}</strong></div>
        ))}
      </section>
      <ChannelOrders channel="Agentic" onOpen={onOpen} />
    </>
  )
}
