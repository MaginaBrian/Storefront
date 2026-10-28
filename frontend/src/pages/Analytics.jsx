import { useState } from 'react'
import { BarChart3, ChevronDown, MoreHorizontal } from 'lucide-react'
import { money } from '../lib/money.js'
import { useJson } from '../lib/api.js'

const RANGES = [['30', 'Last 30 days'], ['7', 'Last 7 days'], ['today', 'Today']]
const BUILTIN = new Set([
  'Gross sales over time',
  'Returning customer rate over time',
  'Orders fulfilled',
  'Gross sales by order',
  'Finance summary',
  'Total sales by channel',
  'Average order value over time',
  'Total sales by product',
  'Sessions over time',
  'Conversion rate over time',
  'Conversion rate breakdown',
  'Sessions by device type',
  'Sessions by location',
  'Sessions by landing page',
  'Customer cohort analysis',
  'Products bought together',
])

function Spark({ points }) {
  const values = (points || []).map(point => point.value)
  const max = Math.max(1, ...values)
  const coords = values.map((value, index) => {
    const x = values.length <= 1 ? 160 : 8 + (index / (values.length - 1)) * 304
    const y = 78 - (value / max) * 64
    return `${x},${y}`
  }).join(' ')
  return (
    <svg className="spark" viewBox="0 0 320 96" role="img" aria-label="Trend">
      <line x1="8" y1="78" x2="312" y2="78" stroke="#E2DDCF" strokeDasharray="4 4" />
      {coords && <polyline fill="none" stroke="#3E6B58" strokeWidth="2" points={coords} />}
    </svg>
  )
}

function Axis({ points }) {
  const labels = points || []
  const shown = labels.length <= 4 ? labels : [labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]]
  return <div className="axis">{shown.map(point => <span key={point.day || point.label}>{point.label}</span>)}</div>
}

function Card({ title, onOpen, children }) {
  return (
    <button type="button" className="chart-card" onClick={onOpen}>
      <h2>{title}</h2>
      {children}
    </button>
  )
}

function Empty({ text }) {
  return <p className="flat-note">{text}</p>
}

export function Analytics({ onOpen }) {
  const [range, setRange] = useState('30')
  const [library, setLibrary] = useState(false)
  const [stats, reloadStats] = useJson(`/api/analytics?range=${range}`)
  const [reports, reloadReports] = useJson('/api/reports')
  const openReport = name => {
    const row = (reports || []).find(item => item.name === name)
    onOpen('reports', row ? { report: row.id } : undefined)
  }
  const pin = row => {
    fetch(`/api/reports/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: row.pinned ? 0 : 1 }),
    }).then(() => { reloadReports(); reloadStats() })
  }
  const sales = stats?.gross_sales || 0
  const extras = (reports || []).filter(row => row.pinned && !BUILTIN.has(row.name))
  const headlines = Object.fromEntries((stats?.pinned || []).map(row => [row.id, row.headline]))
  const none = 'No orders in this date range'
  return (
    <div className="analytics-page">
      <div className="orders-top">
        <h1><BarChart3 size={18} /> Analytics <span>Last refreshed: {stats?.refreshed || '…'}</span></h1>
        <div className="orders-actions">
          <button type="button" className="ghost" aria-label="More analytics actions" onClick={() => setLibrary(value => !value)}><MoreHorizontal size={16} /></button>
          <button type="button" className="ghost" onClick={() => setLibrary(value => !value)}>Customize <ChevronDown size={14} /></button>
          <button type="button" className="solid" onClick={() => onOpen('reports', { create: '1' })}>New exploration</button>
        </div>
      </div>
      {library && (
        <div className="sheet library">
          <p className="muted">Add a report to this dashboard. A new exploration is added on its own.</p>
          {(reports || []).map(row => (
            <label key={row.id} className="metric-check">
              <input type="checkbox" checked={!!row.pinned} onChange={() => pin(row)} />
              {row.name}
              <span className="quiet-tag">{row.category}</span>
            </label>
          ))}
        </div>
      )}
      <div className="analytics-filters">
        <label>Range
          <select value={range} onChange={e => setRange(e.target.value)}>
            {RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <span className="date-chip">{stats?.label || '…'}</span>
        <span className="date-chip">Kenyan Shilling (KES)</span>
      </div>
      {extras.length > 0 && (
        <div className="analytics-kpis">
          {extras.map(row => (
            <button type="button" className="chart-card kpi-card" key={row.id} onClick={() => onOpen('reports', { report: row.id })}>
              <span>{row.name}</span>
              <strong>{headlines[row.id] || '—'}</strong>
              <i />
            </button>
          ))}
        </div>
      )}
      <div className="analytics-kpis">
        {[
          ['Gross sales', money(sales), 'Gross sales over time'],
          ['Returning customer rate', stats?.returning_rate || '—', 'Returning customer rate over time'],
          ['Orders fulfilled', String(stats?.orders_fulfilled || 0), 'Orders fulfilled'],
          ['Orders', String(stats?.orders || 0), 'Gross sales by order'],
        ].map(([label, value, report]) => (
          <button type="button" className="chart-card kpi-card" key={label} onClick={() => openReport(report)}>
            <span>{label}</span><strong>{value}</strong><i />
          </button>
        ))}
      </div>
      <div className="analytics-grid split">
        <Card title="Total sales over time" onOpen={() => openReport('Gross sales over time')}>
          <strong className="chart-value">{money(sales)}</strong>
          <Spark points={stats?.sales_series} />
          <Axis points={stats?.sales_series} />
          <p className="legend"><i /> {stats?.label} <i className="pale" /> {stats?.previous_label} · {money(stats?.previous_gross || 0)}</p>
        </Card>
        <Card title="Total sales breakdown" onOpen={() => openReport('Finance summary')}>
          <ul className="breakdown">
            {(stats?.breakdown || []).map(row => <li key={row.label}><span>{row.label}</span><b>{money(row.value)}</b></li>)}
          </ul>
        </Card>
      </div>
      <div className="analytics-grid three">
        <Card title="Total sales by sales channel" onOpen={() => openReport('Total sales by channel')}>
          {(stats?.by_channel || []).length === 0 ? <Empty text={none} /> : stats.by_channel.map(row => (
            <div className="sell-row" key={row.name}><span>{row.name}</span><b>{money(row.value)}</b></div>
          ))}
        </Card>
        <Card title="Average order value over time" onOpen={() => openReport('Average order value over time')}>
          <strong className="chart-value">{stats?.orders ? money(stats.aov) : '—'}</strong>
          <Spark points={stats?.aov_series} />
          <Axis points={stats?.aov_series} />
        </Card>
        <Card title="Total sales by product" onOpen={() => openReport('Total sales by product')}>
          {(stats?.by_product || []).length === 0 ? <Empty text={none} /> : stats.by_product.map(row => (
            <div className="sell-row" key={row.name}><span>{row.name}</span><b>{money(row.value)}</b></div>
          ))}
        </Card>
      </div>
      <div className="analytics-grid three">
        <Card title="Sessions over time" onOpen={() => openReport('Sessions over time')}>
          <strong className="chart-value">{stats?.sessions || 0}</strong>
          <Spark points={stats?.session_series} />
          <Axis points={stats?.session_series} />
          <p className="muted">One visit is recorded for each order.</p>
        </Card>
        <Card title="Conversion rate over time" onOpen={() => openReport('Conversion rate over time')}>
          <strong className="chart-value">{stats?.conversion || '0%'}</strong>
          <Spark points={stats?.session_series} />
          <Axis points={stats?.session_series} />
        </Card>
        <Card title="Conversion rate breakdown" onOpen={() => openReport('Conversion rate breakdown')}>
          <strong className="funnel-pct">{stats?.conversion || '0%'}</strong>
          <div className="funnel-steps">
            {(stats?.funnel || []).map(step => (
              <div key={step.label}>
                <span>{step.label}</span>
                <b>{step.pct}</b>
                <em>{step.count}</em>
                <i style={{ height: Math.max(6, Math.round((step.count / Math.max(stats?.sessions || 1, 1)) * 78)) }} />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="analytics-grid three">
        <Card title="Sessions by device type" onOpen={() => openReport('Sessions by device type')}>
          {(stats?.devices || []).length === 0 ? <Empty text="No visits in this date range" /> : stats.devices.map(row => (
            <div className="sell-row" key={row.name}><span>{row.name}</span><b>{row.count}</b></div>
          ))}
        </Card>
        <Card title="Sessions by location" onOpen={() => openReport('Sessions by location')}>
          {(stats?.locations || []).length === 0 ? <Empty text="No visits in this date range" /> : stats.locations.map(row => (
            <div key={row.name}><p className="loc-label">{row.name}</p><div className="loc-bar"><i /><b>{row.count}</b></div></div>
          ))}
        </Card>
        <Card title="Total sales by social referrer" onOpen={() => openReport('Sessions by social referrer')}>
          {(stats?.social || []).length === 0 ? <Empty text="No social referrers in this date range" /> : stats.social.map(row => (
            <div className="sell-row" key={row.name}><span>{row.name}</span><b>{row.count}</b></div>
          ))}
        </Card>
      </div>
      <div className="analytics-grid split">
        <Card title="Customer cohort analysis" onOpen={() => openReport('Customer cohort analysis')}>
          <table className="cohort">
            <thead><tr><th>Cohort</th>{Array.from({ length: 6 }, (_, index) => <th key={index}>{index === 0 ? 'First' : `+${index}`}</th>)}</tr></thead>
            <tbody>
              {(stats?.cohorts || []).map(row => (
                <tr key={row.month}><td>{row.month}</td>{row.values.map((value, index) => <td key={index}>{value}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Sessions by landing page" onOpen={() => openReport('Sessions by landing page')}>
          {(stats?.landing_pages || []).length === 0 ? <Empty text="No visits in this date range" /> : stats.landing_pages.map(row => (
            <div className="sell-row" key={row.path}><span>{row.path}</span><b>{row.count}</b></div>
          ))}
        </Card>
      </div>
      <div className="analytics-grid three">
        <Card title="Sessions by referrer" onOpen={() => openReport('Sessions by referrer')}>
          {(stats?.referrers || []).length === 0 ? <Empty text="No referrers in this date range" /> : stats.referrers.map(row => (
            <div className="sell-row" key={row.name}><span>{row.name}</span><b>{row.count}</b></div>
          ))}
        </Card>
        <Card title="Products bought together" onOpen={() => openReport('Products bought together')}>
          {(stats?.bought_together || []).length === 0 ? <Empty text="No order in this range contains more than one product." /> : stats.bought_together.map(row => (
            <div className="sell-row" key={row.products.join('|')}><span>{row.products.join(' + ')}</span><b>{row.orders}</b></div>
          ))}
        </Card>
        <Card title="Products by sell-through rate" onOpen={() => onOpen('products')}>
          {(stats?.sell_through || []).map(row => (
            <div className="sell-row" key={row.name}><span>{row.name}</span><b>{row.rate}%</b></div>
          ))}
        </Card>
      </div>
    </div>
  )
}
