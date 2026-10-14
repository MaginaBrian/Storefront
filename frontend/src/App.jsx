import { useEffect, useState } from 'react'
import {
  House, Inbox, Tag, Users, TrendingUp, Percent, FileText, Globe, BarChart3,
  Store, Sparkles, Settings, Search, Plus, Smartphone,
} from 'lucide-react'

const NAV = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'orders', label: 'Orders', icon: Inbox },
  { id: 'products', label: 'Products', icon: Tag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'growth', label: 'Growth', icon: TrendingUp },
  { id: 'discounts', label: 'Discounts', icon: Percent },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'markets', label: 'Markets', icon: Globe },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]
const CHANNELS = [
  { id: 'store', label: 'Online Store', icon: Store },
  { id: 'agentic', label: 'Agentic', icon: Sparkles },
]
const SETTINGS = { id: 'settings', label: 'Settings', icon: Settings }

const money = (n, c = 'KES') => `${c} ${(n / 100).toLocaleString()}`

function useApi(path) {
  const [data, setData] = useState(null)
  const load = () => fetch(path).then(r => r.json()).then(setData)
  useEffect(() => { load() }, [path])
  return [data, load]
}

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

function Home() {
  const [d] = useApi('/api/dashboard')
  if (!d) return null
  return (
    <>
      <div className="page-head">
        <h1 className="title">Sales performance</h1>
        <button className="cta"><Plus size={15} /> Add product</button>
      </div>
      <section className="kpis">
        {d.kpis.map(k => (
          <div className="card kpi" key={k.label}>
            <div className="kpi-top"><span>{k.label}</span><i style={{ background: TONES[k.tone][0], color: TONES[k.tone][1] }} /></div>
            <div className="kpi-val"><strong>{k.value}</strong><em className={k.good ? 'up' : 'down'}>{k.note}</em></div>
          </div>
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
                  <b style={{ background: SHADES[i] }} />
                  <div><span>{c.name}</span><strong>KES {c.sales.toLocaleString()}</strong></div>
                  <div className="r"><span>{c.orders} orders</span><em className={c.delta > 0 ? 'up' : 'down'}>{Math.abs(c.delta)}%</em></div>
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
          <div className="between"><h3>Recent orders</h3><button className="btn">View all</button></div>
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {d.recent.map(r => (
                <tr key={r.id}><td>#{r.id}</td><td>{r.customer}</td><td>{r.date}</td><td>{r.amount}</td>
                  <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Top products</h3>
          <ul className="top">
            {d.top.map((t, i) => (
              <li key={t.title}><b style={{ background: SHADES[i % 4] }}>{t.title[0]}</b>
                <div><strong>{t.title}</strong><small>{t.sold} units sold</small></div><span>{t.sales}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

function Orders() {
  const [rows, reload] = useApi('/api/orders')
  const fulfil = id =>
    fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fulfilled' }),
    }).then(reload)
  return (
    <>
      <h1 className="title">Orders</h1>
      <table>
        <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows?.map(r => (
            <tr key={r.id}>
              <td>#{r.id}</td><td>{r.customer}</td><td>{money(r.total)}</td>
              <td><span className={`pill ${r.status}`}>{r.status}</span></td>
              <td>{r.status !== 'fulfilled' && <button className="btn" onClick={() => fulfil(r.id)}>Mark fulfilled</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Products() {
  const [rows] = useApi('/api/products')
  return (
    <>
      <h1 className="title">Products</h1>
      <table>
        <thead><tr><th>Product</th><th>Price</th><th>In stock</th></tr></thead>
        <tbody>
          {rows?.map(r => (
            <tr key={r.id}><td>{r.title}</td><td>{money(r.price)}</td><td>{r.stock}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

const Soon = ({ name }) => (
  <>
    <h1 className="title">{name}</h1>
    <p className="muted">Nothing here yet. This section is ready for you to build.</p>
  </>
)

export default function App() {
  const [view, setView] = useState('home')
  const label = [...NAV, ...CHANNELS, SETTINGS].find(n => n.id === view).label
  const item = ({ id, label, icon: Icon }) => (
    <button key={id} className={`nav ${view === id ? 'on' : ''}`} onClick={() => setView(id)}>
      <Icon size={17} strokeWidth={1.6} />{label}
    </button>
  )
  return (
    <div className="shell">
      <aside>
        <div className="brand">Maison</div>
        <label className="search"><Search size={15} /><input placeholder="Search" /><kbd>Ctrl K</kbd></label>
        <nav>{NAV.map(item)}</nav>
        <p className="group">Sales channels</p>
        <nav>{CHANNELS.map(item)}</nav>
        <div className="promo">
          <strong>Run your store anywhere</strong>
          <p>Get order alerts, low-stock warnings and live sales on your phone.</p>
          <button className="cta"><Smartphone size={14} /> Get the app</button>
        </div>
        <div className="foot">{item(SETTINGS)}</div>
      </aside>
      <main>
        {view === 'home' ? <Home /> : view === 'orders' ? <Orders />
          : view === 'products' ? <Products /> : <Soon name={label} />}
      </main>
    </div>
  )
}
