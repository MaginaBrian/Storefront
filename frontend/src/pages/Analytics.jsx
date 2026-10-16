import { useState } from 'react'
import { BarChart3, ChevronDown, MoreHorizontal } from 'lucide-react'

const HOURS = ['12 AM', '5 AM', '10 AM', '3 PM', '8 PM']
const BREAKDOWN = ['Gross sales', 'Discounts', 'Sales reversals', 'Net sales', 'Shipping charges', 'Return fees', 'Taxes', 'Total sales']
const COHORT = [
  ['Feb 2026', 8],
  ['Mar 2026', 7],
  ['Apr 2026', 6],
  ['May 2026', 5],
  ['Jun 2026', 4],
  ['Jul 2026', 3],
  ['Aug 2026', 2],
  ['Sep 2026', 1],
]
const SELL = [
  ['Drawstrings', 'Teal'],
  ['Mwotaji - Vest', 'Off White', 'products', { product: 'Mwotaji - Vest' }],
  ['A1544-3 (B1820) Rib fabric', 'White', 'inventory', { product: 'A1544-3 (B1820) Rib fabric' }],
  ['B1820 - Fabric', 'White', 'inventory', { product: 'B1820 - Fabric' }],
  ['Mwotaji - Hoodie', 'Black'],
]

function Spike({ tall }) {
  return (
    <svg className="spark" viewBox="0 0 320 96" role="img" aria-label="Sessions over the day">
      <line x1="8" y1="78" x2="312" y2="78" stroke="#d5e4f7" strokeDasharray="4 4" />
      {tall
        ? <polyline fill="none" stroke="#2f6bff" strokeWidth="2" points="8,78 196,78 214,10 232,78 312,78" />
        : <polyline fill="none" stroke="#7eb6ff" strokeWidth="2" points="8,78 312,78" />}
    </svg>
  )
}

function Axis({ labels = HOURS }) {
  return <div className="axis">{labels.map(label => <span key={label}>{label}</span>)}</div>
}

function Legend() {
  return (
    <p className="legend"><i /> Oct 14, 2026 <i className="pale" /> Oct 13, 2026</p>
  )
}

function Funnel() {
  const steps = [['Sessions', '100%', '1', 78], ['Added to cart', '0%', '0', 10], ['Reached checkout', '0%', '0', 8], ['Completed', '0%', '0', 6]]
  return (
    <div className="funnel">
      <strong className="funnel-pct">0%</strong>
      <div className="funnel-steps">
        {steps.map(([label, pct, count, height]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{pct}</b>
            <em>{count}</em>
            <i style={{ height }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function DeviceDonut() {
  return (
    <div className="device">
      <svg viewBox="0 0 120 120" aria-label="1 desktop session">
        <circle cx="60" cy="60" r="42" fill="none" stroke="#e7f3ff" strokeWidth="14" />
        <circle cx="60" cy="60" r="42" fill="none" stroke="#2f9bff" strokeWidth="14" strokeDasharray="264 264" transform="rotate(-90 60 60)" />
        <text x="60" y="66" textAnchor="middle" fontSize="22" fontFamily="inherit">1</text>
      </svg>
      <p><i /> Desktop <b>1</b></p>
    </div>
  )
}

export function Analytics({ onOpen }) {
  const [range, setRange] = useState('Today')
  const [targets, setTargets] = useState(false)
  return (
    <div className="analytics-page">
      <div className="orders-top">
        <h1><BarChart3 size={18} /> Analytics <span>Last refreshed: 6:35 PM</span></h1>
        <div className="orders-actions">
          <button type="button" className="ghost" aria-label="More analytics actions"><MoreHorizontal size={16} /></button>
          <button type="button" className="ghost" onClick={() => setTargets(value => !value)}>Try targets <ChevronDown size={14} /></button>
          <button type="button" className="solid" onClick={() => onOpen('reports', { create: '1' })}>New exploration</button>
        </div>
      </div>
      {targets && <p className="target-note">Targets compare today with Oct 13, 2026. Sessions target is 1. Sales target is KES 0.00.</p>}
      <div className="analytics-filters">
        <label>Range
          <select value={range} onChange={e => setRange(e.target.value)}>
            <option>Today</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
        </label>
        <span className="date-chip">Oct 13, 2026</span>
        <span className="date-chip">Kenyan Shilling (KES)</span>
      </div>
      <div className="analytics-kpis">
        {[['Gross sales', 'KES 0'], ['Returning customer rate', '—'], ['Orders fulfilled', '0'], ['Orders', '0']].map(([label, value]) => (
          <article key={label} className="chart-card kpi-card"><span>{label}</span><strong>{value}</strong><i /></article>
        ))}
      </div>
      <div className="analytics-grid split">
        <article className="chart-card">
          <h2>Total sales over time</h2>
          <strong className="chart-value">KES 0.00</strong>
          <div className="y-axis"><span>KES 10</span><span>KES 5</span><span>KES 0</span></div>
          <Spike />
          <Axis labels={['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM']} />
          <Legend />
        </article>
        <article className="chart-card">
          <h2>Total sales breakdown</h2>
          <ul className="breakdown">
            {BREAKDOWN.map(label => <li key={label}><span>{label}</span><b>KES 0.00</b><em>—</em></li>)}
          </ul>
        </article>
      </div>
      <div className="analytics-grid three">
        <article className="chart-card"><h2>Total sales by sales channel</h2><p className="flat-note">No data for this date range</p></article>
        <article className="chart-card">
          <h2>Average order value over time</h2>
          <strong className="chart-value">—</strong>
          <div className="y-axis"><span>KES 10</span><span>KES 5</span><span>KES 0</span></div>
          <Spike />
          <Axis />
          <Legend />
        </article>
        <article className="chart-card"><h2>Total sales by product</h2><p className="flat-note">No data for this date range</p></article>
      </div>
      <div className="analytics-grid three">
        <article className="chart-card">
          <h2>Sessions over time</h2>
          <strong className="chart-value">1</strong>
          <Spike tall />
          <Axis />
          <Legend />
        </article>
        <article className="chart-card">
          <h2>Conversion rate over time</h2>
          <strong className="chart-value">0%</strong>
          <Spike />
          <Axis />
          <Legend />
        </article>
        <article className="chart-card">
          <h2>Conversion rate breakdown</h2>
          <Funnel />
        </article>
      </div>
      <div className="analytics-grid three">
        <article className="chart-card">
          <h2>Sessions by device type</h2>
          <DeviceDonut />
        </article>
        <article className="chart-card">
          <h2>Sessions by location</h2>
          <p className="loc-label">Kenya · Nairobi County · Nairobi</p>
          <div className="loc-bar"><i /><b>1</b></div>
        </article>
        <article className="chart-card"><h2>Total sales by social referrer</h2><p className="flat-note">No data for this date range</p></article>
      </div>
      <div className="analytics-grid split">
        <article className="chart-card">
          <h2>Customer cohort analysis</h2>
          <table className="cohort">
            <thead><tr><th>Cohort</th><th colSpan={8}>Months</th></tr></thead>
            <tbody>
              {COHORT.map(([month, cells]) => (
                <tr key={month}>
                  <td>{month}</td>
                  {Array.from({ length: cells }, (_, index) => <td key={index}>0%</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="text-link" onClick={() => onOpen('customers')}>View customers</button>
        </article>
        <article className="chart-card">
          <h2>Sessions by landing page</h2>
          <button type="button" className="sell-row" onClick={() => onOpen('products')}><span>None · /products_preview</span><b>1</b></button>
        </article>
      </div>
      <div className="analytics-grid three">
        <article className="chart-card"><h2>Sessions by social referrer</h2><p className="flat-note">No data for this date range</p></article>
        <article className="chart-card"><h2>Total sales by referrer</h2><p className="flat-note">No data for this date range</p></article>
        <article className="chart-card">
          <h2>Performance by marketing channel</h2>
          <button type="button" className="text-link" onClick={() => onOpen('store')}>shopify</button>
        </article>
      </div>
      <div className="analytics-grid three">
        <article className="chart-card">
          <h2>Sessions by referrer</h2>
          <p className="loc-label">Unknown · shopify · Nairobi</p>
          <div className="loc-bar"><i /><b>1</b></div>
        </article>
        <article className="chart-card"><h2>Total sales by POS location</h2><p className="flat-note">No data for this date range</p></article>
        <article className="chart-card">
          <h2>Products by sell-through rate</h2>
          {SELL.map(([name, variant, view, focus]) => (
            <div className="sell-row" key={`${name}-${variant}`}>
              {view
                ? <button type="button" className="text-link" onClick={() => onOpen(view, focus)}>{name} · {variant} · None</button>
                : <span>{name} · {variant} · None</span>}
              <b>0%</b>
            </div>
          ))}
        </article>
      </div>
      <article className="chart-card"><h2>POS staff sales total</h2><p className="flat-note">No data for {range.toLowerCase()}</p></article>
    </div>
  )
}
