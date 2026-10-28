import { money } from '../lib/money.js'
import { useJson } from '../lib/api.js'

export function LiveView({ onOpen }) {
  const [stats] = useJson('/api/analytics?range=today')
  const live = stats?.live
  const visitor = live?.visitor
  return (
    <div className="analytics-page">
      <div className="orders-top">
        <h1>Live View <span>Last refreshed: {stats?.refreshed || '…'}</span></h1>
      </div>
      <div className="analytics-grid three">
        <article className="chart-card">
          <h2>Visitors right now</h2>
          <strong className="chart-value">{live?.visitors_now || 0}</strong>
          {visitor
            ? <p>{visitor.device} · {[visitor.city, visitor.country].filter(Boolean).join(', ')}</p>
            : <p className="muted">No visitors in the last 15 minutes.</p>}
        </article>
        <article className="chart-card">
          <h2>Orders today</h2>
          <strong className="chart-value">{live?.orders_today || 0}</strong>
          <p className="muted">{money(live?.orders_today_total || 0)}</p>
          <button type="button" className="ghost" onClick={() => onOpen('orders')}>View orders</button>
        </article>
        <article className="chart-card">
          <h2>Landing page</h2>
          {visitor
            ? <button type="button" className="text-link" onClick={() => onOpen('products')}>{visitor.landing}</button>
            : <p className="muted">No active landing page.</p>}
        </article>
      </div>
      <article className="chart-card">
        <h2>Recent orders</h2>
        {(live?.recent_orders || []).length === 0 ? <p className="flat-note">No orders yet.</p> : (
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th></tr></thead>
            <tbody>
              {live.recent_orders.map(order => (
                <tr key={order.id}>
                  <td><button type="button" className="text-link" onClick={() => onOpen('orders', { order: order.id })}>#{order.id}</button></td>
                  <td>{order.customer}</td>
                  <td>{order.created_at}</td>
                  <td>{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  )
}
