import { useEffect, useLayoutEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '../lib/api.js'

const LIGHT_SHADES = ['#14261F', '#3E6B58', '#8FA99B', '#B08D4A', '#D9CFB8']
const DARK_SHADES = ['#C0A062', '#3E6B58', '#6F9482', '#A9BDB1', '#E5DCC5']
const LIGHT_TONES = { green: ['#E4EEE7', '#2F6B4F'], amber: ['#F3E8CC', '#8A6414'], violet: ['#EFE6D2', '#B08D4A'], red: ['#F2DEDC', '#8E2F2F'] }
const DARK_TONES = { green: ['#1F3A2E', '#6FBF8F'], amber: ['#3A3018', '#C0A062'], violet: ['#2A332C', '#A9BDB1'], red: ['#3A2422', '#D27A6E'] }

function usePalette() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark')
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark ? [DARK_SHADES, DARK_TONES] : [LIGHT_SHADES, LIGHT_TONES]
}

function Donut({ data, shades }) {
  const total = data.reduce((a, d) => a + d.sales, 0), r = 70, C = 2 * Math.PI * r
  let off = 0
  return (
    <svg viewBox="0 0 200 200" className="donut">
      <g transform="rotate(-90 100 100)" fill="none" strokeWidth="26">
        {data.map((d, i) => {
          const len = (d.sales / total) * C
          const el = <circle key={d.name} cx="100" cy="100" r={r} stroke={shades[i % shades.length]} strokeDasharray={`${len - 2} ${C}`} strokeDashoffset={-off} />
          off += len
          return el
        })}
      </g>
      <text x="100" y="98" textAnchor="middle" className="d-big">{(total / 1000).toFixed(1)}K</text>
      <text x="100" y="118" textAnchor="middle" className="d-small">Total sales</text>
    </svg>
  )
}

function figure(value, t) {
  const text = String(value ?? '')
  if (t >= 1) return text
  const match = text.match(/^(.*?)(\d[\d,.]*)(.*)$/)
  if (!match) return text
  const raw = match[2].replace(/,/g, '')
  const num = Number(raw)
  if (!Number.isFinite(num)) return text
  const decimals = (raw.split('.')[1] || '').length
  const current = num * t
  const shown = match[2].includes(',')
    ? current.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : (decimals ? current.toFixed(decimals) : String(Math.round(current)))
  return `${match[1]}${shown}${match[3]}`
}

function inkOn(hex) {
  const n = parseInt(hex.slice(1), 16)
  const lum = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114
  return lum > 150 ? '#14261F' : '#F4F1EA'
}

function ease(p, start) {
  const x = Math.min(1, Math.max(0, (p - start) / (1 - start)))
  return 1 - (1 - x) ** 3
}

function LimitedHome({ onOpen, access }) {
  const cards = [
    ['orders', 'Orders', 'The purchase: customer, products, quantities, prices, and discounts.'],
    ['products', 'Products', 'What you sell, including variants, prices, and inventory.'],
    ['customers', 'Customers', 'Who buys, and whether they come back.'],
    ['discounts', 'Discounts', 'The offer on a product, an order, or shipping.'],
    ['markets', 'Markets', 'Who you sell to, and the prices and catalog they see.'],
    ['analytics', 'Analytics', 'What the orders and visits add up to.'],
  ].filter(([key]) => access.includes(key))
  return (
    <div className="dash">
      <div className="page-head">
        <h1 className="title">Your work</h1>
      </div>
      <p className="muted">Your role opens only part of the store. Products are what you sell, customers are who buys, discounts are the offer, orders record the purchase, markets shape the experience, and analytics shows the result.</p>
      <div className="permit-grid">
        {cards.map(([key, label, detail]) => (
          <button type="button" key={key} className="card" onClick={() => onOpen(key)}>
            <strong>{label}</strong>
            <small>{detail}</small>
          </button>
        ))}
        {access.includes('products') && <button type="button" className="solid" onClick={() => onOpen('products', { add: '1' })}><Plus size={15} /> Add product</button>}
      </div>
    </div>
  )
}

export default function Home({ onOpen, access }) {
  const [d] = useApi(!access || access.includes('analytics') ? '/api/dashboard' : '')
  const [p, setP] = useState(0)
  const [grown, setGrown] = useState(false)
  useLayoutEffect(() => {
    if (!d) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setP(1); setGrown(true); return }
    setP(0)
    setGrown(false)
    const start = performance.now()
    let raf = 0
    const tick = now => {
      const next = Math.min(1, (now - start) / 1300)
      setP(next)
      if (next < 1) raf = requestAnimationFrame(tick)
    }
    const grow = requestAnimationFrame(() => setGrown(true))
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(grow) }
  }, [d])
  const [shades, tones] = usePalette()
  const kpis = d?.kpis || [0, 1, 2, 3].map(i => ({ label: '', value: '0', note: '', good: true, tone: ['green', 'amber', 'violet', 'red'][i] }))
  const week = d?.week || Array.from({ length: 7 }, () => ['', 0])
  const openKpi = label => onOpen(label === 'Orders' ? 'orders' : label === 'New customers' ? 'customers' : label === 'Low stock' ? 'products' : 'analytics', label === 'Low stock' ? { stock: 'low' } : undefined)
  if (access && !access.includes('analytics')) return <LimitedHome onOpen={onOpen} access={access} />
  return (
    <div className="dash">
      <div className="page-head rise" style={{ animationDelay: '0ms' }}>
        <h1 className="title">Sales performance</h1>
        <button className="cta" onClick={() => onOpen('products', { add: '1' })}><Plus size={15} /> Add product</button>
      </div>
      <section className="kpis">
        {kpis.map((k, i) => {
          const step = ease(p, i * 0.08)
          return (
            <button type="button" className="card kpi rise" key={k.label || i} style={{ animationDelay: `${i * 70}ms` }} onClick={d ? () => openKpi(k.label) : undefined}>
              <div className="kpi-top"><span>{k.label}</span><i style={{ background: tones[k.tone][0], color: tones[k.tone][1] }} /></div>
              <div className="kpi-val"><strong>{figure(k.value, step)}</strong>{k.note && <em className={k.good ? 'up' : 'down'} style={{ opacity: step }}>{k.note}</em>}</div>
            </button>
          )
        })}
      </section>
      <section className="row two">
        <div className="card rise" style={{ animationDelay: '160ms' }}>
          <h3>Sales by channel</h3>
          <div className="channels">
            {d && <Donut data={d.channels} shades={shades} />}
            <ul>
              {(d?.channels || []).map((c, i) => {
                const step = ease(p, 0.12 + i * 0.04)
                return (
                  <li key={c.name}>
                    <button type="button" className="channel-hit" onClick={() => onOpen('orders', { channel: c.name })}>
                    <b style={{ background: shades[i % shades.length] }} />
                    <div><span>{c.name}</span><strong>{figure(`KES ${c.sales.toLocaleString('en-US')}`, step)}</strong></div>
                    <div className="r"><span>{figure(c.orders, step)} orders</span><em className={c.delta > 0 ? 'up' : 'down'}>{Math.abs(c.delta)}%</em></div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <div className="card rise" style={{ animationDelay: '240ms' }}>
          <h3>This week</h3>
          <div className="bars">
            {week.map(([day, v], i) => (
              <div key={day || i}><span className={i === 6 ? 'bar hot' : 'bar'} style={{ height: grown ? `${v}%` : '0%', transitionDelay: `${180 + i * 55}ms` }} /><small>{day}</small></div>
            ))}
          </div>
        </div>
      </section>
      <section className="row two b">
        <div className="card rise" style={{ animationDelay: '300ms' }}>
          <div className="between"><h3>Recent orders</h3><button className="btn" onClick={() => onOpen('orders')}>View all</button></div>
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {(d?.recent || []).map((r, i) => (
                <tr key={r.id} className="clickable rise-row" style={{ animationDelay: `${360 + i * 80}ms` }} onClick={() => onOpen('orders', { order: r.id })}>
                  <td>#{r.id}</td>
                  <td><button type="button" className="text-link" onClick={e => { e.stopPropagation(); onOpen('customers', { customer: r.customer }) }}>{r.customer}</button></td>
                  <td>{r.date}</td><td>{figure(r.amount, ease(p, 0.2 + i * 0.06))}</td>
                  <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card rise" style={{ animationDelay: '380ms' }}>
          <h3>Top products</h3>
          <ul className="top">
            {(d?.top || []).map((t, i) => (
              <li key={t.title} className="rise-row" style={{ animationDelay: `${420 + i * 80}ms` }}><button type="button" className="top-hit" onClick={() => onOpen('products', { product: t.title })}><b style={{ background: shades[i % 4], color: inkOn(shades[i % 4]) }}>{t.title[0]}</b>
                <div><strong>{t.title}</strong><small>{figure(t.sold, ease(p, 0.18 + i * 0.06))} units sold</small></div><span>{figure(t.sales, ease(p, 0.18 + i * 0.06))}</span></button></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
