import { Plus } from 'lucide-react'
import { useApi } from '../lib/api.js'

const TONES = { green: ['#e3f6ea', '#1f9d55'], amber: ['#fff1d6', '#e59a0d'], violet: ['#e8e9fb', '#5b6bd1'], red: ['#fde4e4', '#e5262b'] }
const SHADES = ['#3b4488', '#5b6bd1', '#8b94e8', '#c3c8f5', '#e4e6ef']

function Donut({ data }) {
  const total = data.reduce((a, d) => a + d.sales, 0), r = 70, C = 2 * Math.PI * r
  let off = 0
  return (
    <svg viewBox="0 0 200 200" className="donut">
      <g transform="rotate(-90 100 100)" fill="none" strokeWidth="26">
        {data.map((d, i) => {
          const len = (d.sales / total) * C
          const el = <circle key={d.name} cx="100" cy="100" r={r} stroke={SHADES[i]} strokeDasharray={`${len - 2} ${C}`} strokeDashoffset={-off} />
          off += len
          return el
        })}
      </g>
      <text x="100" y="98" textAnchor="middle" className="d-big">{(total / 1000).toFixed(1)}K</text>
      <text x="100" y="118" textAnchor="middle" className="d-small">Total sales</text>
    </svg>
  )
}

export default function Home({ onOpen }) {
  const [d] = useApi('/api/dashboard')
  if (!d) return null
  return (
    <>
      <div className="page-head">
        <h1 className="title">Sales performance</h1>
        <button className="cta" onClick={() => onOpen('products', { add: '1' })}><Plus size={15} /> Add product</button>
      </div>
      <section className="kpis">
        {d.kpis.map(k => (
          <button type="button" className="card kpi" key={k.label} onClick={() => onOpen(k.label === 'Orders' ? 'orders' : k.label === 'New customers' ? 'customers' : k.label === 'Low stock' ? 'products' : 'analytics', k.label === 'Low stock' ? { stock: 'low' } : undefined)}>
            <div className="kpi-top"><span>{k.label}</span><i style={{ background: TONES[k.tone][0], color: TONES[k.tone][1] }} /></div>
            <div className="kpi-val"><strong>{k.value}</strong><em className={k.good ? 'up' : 'down'}>{k.note}</em></div>
          </button>
        ))}
      </section>
      <section className="row two">
        <div className="card">
          <h3>Sales by channel</h3>
          <div className="channels">
            <Donut data={d.channels} />
            <ul>
              {d.channels.map((c, i) => (
                <li key={c.name}>
                  <button type="button" className="channel-hit" onClick={() => onOpen('orders', { channel: c.name })}>
                  <b style={{ background: SHADES[i] }} />
                  <div><span>{c.name}</span><strong>KES {c.sales.toLocaleString()}</strong></div>
                  <div className="r"><span>{c.orders} orders</span><em className={c.delta > 0 ? 'up' : 'down'}>{Math.abs(c.delta)}%</em></div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <h3>This week</h3>
          <div className="bars">
            {d.week.map(([day, v], i) => (
              <div key={day}><span className={i === 6 ? 'bar hot' : 'bar'} style={{ height: `${v}%` }} /><small>{day}</small></div>
            ))}
          </div>
        </div>
      </section>
      <section className="row two b">
        <div className="card">
          <div className="between"><h3>Recent orders</h3><button className="btn" onClick={() => onOpen('orders')}>View all</button></div>
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {d.recent.map(r => (
                <tr key={r.id} className="clickable" onClick={() => onOpen('orders', { order: r.id })}>
                  <td>#{r.id}</td>
                  <td><button type="button" className="text-link" onClick={e => { e.stopPropagation(); onOpen('customers', { customer: r.customer }) }}>{r.customer}</button></td>
                  <td>{r.date}</td><td>{r.amount}</td>
                  <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Top products</h3>
          <ul className="top">
            {d.top.map((t, i) => (
              <li key={t.title}><button type="button" className="top-hit" onClick={() => onOpen('products', { product: t.title })}><b style={{ background: SHADES[i % 4] }}>{t.title[0]}</b>
                <div><strong>{t.title}</strong><small>{t.sold} units sold</small></div><span>{t.sales}</span></button></li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
