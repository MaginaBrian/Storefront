import { useApi } from '../lib/api.js'

export function Analytics({ onOpen }) {
  const [data] = useApi('/api/analytics')
  if (!data) return null
  return (
    <>
      <h1 className="title">Analytics</h1>
      <div className="card">
        <h3>Sales by channel</h3>
        <table>
          <thead><tr><th>Channel</th><th>Orders</th><th>Sales</th><th>Change</th></tr></thead>
          <tbody>
            {data.channels.map(c => (
              <tr key={c.name}>
                <td><button type="button" className="text-link" onClick={() => onOpen('orders', { channel: c.name })}>{c.name}</button></td>
                <td>{c.orders.toLocaleString()}</td>
                <td>KES {c.sales.toLocaleString()}</td>
                <td><em className={c.delta > 0 ? 'up' : 'down'}>{Math.abs(c.delta)}%</em></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
