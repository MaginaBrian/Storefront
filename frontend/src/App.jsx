import { useEffect, useState } from 'react'
import {
  House, Inbox, Tag, Users, TrendingUp, Percent, FileText, Globe, BarChart3,
  Store, Sparkles, Settings, Search, Plus, Smartphone,
} from 'lucide-react'
import OrdersSection from './Orders.jsx'
import { Products, Customers, Discounts, Content, Markets, Growth, Analytics, StorePage, AgenticPage, Settings as SettingsPage } from './Pages.jsx'

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

const VIEWS = new Set([...NAV, ...CHANNELS, SETTINGS].map(n => n.id).concat(['drafts', 'checkouts']))

function readView() {
  const id = location.hash.replace(/^#\/?/, '')
  return VIEWS.has(id) ? id : 'home'
}

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

function Home({ onOpen }) {
  const [d] = useApi('/api/dashboard')
  if (!d) return null
  return (
    <>
      <div className="page-head">
        <h1 className="title">Sales performance</h1>
        <button className="cta" onClick={() => onOpen('products', 'add')}><Plus size={15} /> Add product</button>
      </div>
      <section className="kpis">
        {d.kpis.map(k => (
          <button type="button" className="card kpi" key={k.label} onClick={() => onOpen(k.label === 'Orders' ? 'orders' : k.label === 'New customers' ? 'customers' : k.label === 'Low stock' ? 'products' : 'analytics')}>
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
                  <button type="button" className="channel-hit" onClick={() => onOpen(c.view)}>
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
                <tr key={r.id} className="clickable" onClick={() => onOpen('orders')}><td>#{r.id}</td><td>{r.customer}</td><td>{r.date}</td><td>{r.amount}</td>
                  <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Top products</h3>
          <ul className="top">
            {d.top.map((t, i) => (
              <li key={t.title}><button type="button" className="top-hit" onClick={() => onOpen('products')}><b style={{ background: SHADES[i % 4] }}>{t.title[0]}</b>
                <div><strong>{t.title}</strong><small>{t.sold} units sold</small></div><span>{t.sales}</span></button></li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

export default function App() {
  const [view, setViewState] = useState(readView)
  const [boot, setBoot] = useState(null)
  const [summary, reloadSummary] = useApi('/api/orders/summary')
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState([])
  useEffect(() => {
    const sync = () => setViewState(readView())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    const focus = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('nav-search')?.focus()
      }
    }
    window.addEventListener('keydown', focus)
    return () => window.removeEventListener('keydown', focus)
  }, [])
  useEffect(() => {
    if (search.trim().length < 2) { setHits([]); return }
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(search.trim())}`).then(r => r.json()).then(setHits).catch(() => setHits([]))
    }, 150)
    return () => clearTimeout(handle)
  }, [search])
  const setView = (id, extra) => {
    setBoot(extra ? { id: extra, n: Date.now() } : null)
    setSearch('')
    setHits([])
    const next = `#/${id}`
    if (location.hash !== next) location.hash = next
    setViewState(id)
  }
  const pages = [...NAV, ...CHANNELS, SETTINGS, { id: 'drafts', label: 'Drafts' }, { id: 'checkouts', label: 'Abandoned checkouts' }]
  const pageHits = search.trim().length < 2 ? [] : pages.filter(p => p.label.toLowerCase().includes(search.trim().toLowerCase()))
  const item = ({ id, label, icon: Icon }) => (
    <button key={id} className={`nav ${view === id ? 'on' : ''}`} onClick={() => setView(id)}>
      <Icon size={17} strokeWidth={1.6} />{label}
    </button>
  )
  const ordersOpen = view === 'orders' || view === 'drafts' || view === 'checkouts'
  return (
    <div className="shell">
      <aside>
        <button type="button" className="brand" onClick={() => setView('home')}>Maison</button>
        <label className="search"><Search size={15} /><input id="nav-search" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /><kbd>Ctrl K</kbd>
          {(pageHits.length > 0 || hits.length > 0) && (
            <div className="search-results">
              {pageHits.map(p => <button type="button" key={p.id} onClick={() => setView(p.id)}>{p.label}</button>)}
              {hits.map(h => <button type="button" key={h.label} onClick={() => setView(h.view)}>{h.label}</button>)}
            </div>
          )}
        </label>
        <nav>{NAV.map(entry => entry.id === 'orders' ? (
          <div key="orders" className="nest">
            <button className={`nav ${view === 'orders' ? 'on' : ''}`} onClick={() => setView('orders')}>
              <Inbox size={17} strokeWidth={1.6} />Orders
              {summary?.unfulfilled > 0 && <span className="count">{summary.unfulfilled}</span>}
            </button>
            <button className={`sub ${view === 'drafts' ? 'on' : ''}`} onClick={() => setView('drafts')}>Drafts</button>
            <button className={`sub ${view === 'checkouts' ? 'on' : ''}`} onClick={() => setView('checkouts')}>Abandoned checkouts</button>
          </div>
        ) : item(entry))}</nav>
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
        {view === 'home' && <Home onOpen={setView} />}
        {ordersOpen && <OrdersSection view={view} onChanged={reloadSummary} onOpen={setView} />}
        {view === 'products' && <Products boot={boot} />}
        {view === 'customers' && <Customers />}
        {view === 'discounts' && <Discounts />}
        {view === 'content' && <Content />}
        {view === 'markets' && <Markets />}
        {view === 'growth' && <Growth />}
        {view === 'analytics' && <Analytics onOpen={setView} />}
        {view === 'store' && <StorePage />}
        {view === 'agentic' && <AgenticPage />}
        {view === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
