import { useMemo, useState } from 'react'
import { ChevronDown, Printer, Search, ShoppingBag } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'
import { useJson } from '../lib/api.js'

const TODAY = new Date('2026-10-16T12:00:00')
const CATEGORIES = ['Acquisition', 'Behavior', 'Customers', 'Finances', 'Fraud', 'Inventory', 'Marketing', 'Orders', 'Performance', 'Profit Margin', 'Retail Sales', 'Sales', 'Store']
const SESSION = { date: '2026-10-14', country: 'Kenya', region: 'Nairobi County', city: 'Nairobi', visitors: 1, sessions: 1 }

const SPECS = {
  'Net payments by method': {
    kind: 'payments', viz: 'donut', range: '30', compare: 'none', metric: 'Net payments', dimension: 'Payment method',
    from: 'payments', show: 'net_payments', where: "transaction_kind IN ('sale', 'change', 'capture', 'refund')",
  },
  'Items ordered over time': {
    kind: 'items', viz: 'line', range: '30', compare: 'previous', metric: 'Quantity ordered', dimension: 'Day',
    from: 'sales', show: 'quantity_ordered', timeseries: 'day WITH TOTALS, PERCENT_CHANGE',
  },
  'Gross sales over time': {
    kind: 'sales', viz: 'line', range: '30', compare: 'none', metric: 'Gross sales', dimension: 'Day',
    from: 'sales', show: 'gross_sales', timeseries: 'day WITH TOTALS',
  },
  'Sessions by location': {
    kind: 'location', viz: 'horizontal', range: '7', compare: 'none', metric: 'Sessions',
    dimensions: ['Session country', 'Session region', 'Session city'],
    metrics: ['Online store visitors', 'Sessions'],
    from: 'sessions', show: 'online_store_visitors, sessions', where: 'session_country IS NOT NULL',
    filters: ['Session country is not None', 'Human or bot session is Human'],
  },
}

function viewed(isoDate) {
  if (!isoDate) return ''
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function iso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dayLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function shortLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function span(range) {
  const end = new Date(TODAY)
  const start = new Date(TODAY)
  const days = range === '7' ? 6 : range === '90' ? 89 : 30
  start.setDate(end.getDate() - days)
  return { start: iso(start), end: iso(end) }
}

function previous(window) {
  const start = new Date(`${window.start}T00:00:00`)
  const end = new Date(`${window.end}T00:00:00`)
  const length = Math.round((end - start) / 86400000) + 1
  const prevEnd = new Date(start)
  prevEnd.setDate(start.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevEnd.getDate() - length + 1)
  return { start: iso(prevStart), end: iso(prevEnd) }
}

function dates(window) {
  const out = []
  const cursor = new Date(`${window.start}T00:00:00`)
  const end = new Date(`${window.end}T00:00:00`)
  while (cursor <= end) {
    out.push(iso(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function specFor(report) {
  if (SPECS[report.name]) return SPECS[report.name]
  const name = report.name.toLowerCase()
  if (name.includes('session') || name.includes('visitor') || name.includes('bounce') || name.includes('landing') || name.includes('referrer')) {
    return { kind: 'sessions', viz: 'line', range: '30', compare: 'none', metric: 'Sessions', dimension: 'Day', from: 'sessions', show: 'sessions' }
  }
  if (name.includes('item') || name.includes('quantity')) {
    return { kind: 'items', viz: 'line', range: '30', compare: 'none', metric: 'Quantity ordered', dimension: 'Day', from: 'sales', show: 'quantity_ordered', timeseries: 'day' }
  }
  if (name.includes('payment')) {
    return { kind: 'payments', viz: 'donut', range: '30', compare: 'none', metric: 'Net payments', dimension: 'Payment method', from: 'payments', show: 'net_payments' }
  }
  if (name.includes('sale') || name.includes('order') || name.includes('finance') || name.includes('profit') || report.category === 'Sales' || report.category === 'Orders' || report.category === 'Finances') {
    return { kind: 'sales', viz: 'line', range: '30', compare: 'none', metric: 'Gross sales', dimension: 'Day', from: 'sales', show: 'gross_sales', timeseries: 'day' }
  }
  return { kind: 'empty', viz: 'line', range: '30', compare: 'none', metric: report.name, dimension: 'Day', from: 'sales', show: report.name.toLowerCase().replaceAll(' ', '_') }
}

function byDay(rows, window, value) {
  const totals = Object.fromEntries(dates(window).map(day => [day, 0]))
  rows.forEach(row => {
    const day = String(row.created_at).slice(0, 10)
    if (day in totals) totals[day] += value(row)
  })
  return dates(window).map(day => ({ day, value: totals[day] }))
}

function compact(cents) {
  const amount = cents / 100
  if (Math.abs(amount) >= 1000) return `KES ${(amount / 1000).toFixed(1)}K`
  return money(cents)
}

function smooth(points) {
  if (points.length < 2) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    path += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`
  }
  return path
}

function LineChart({ series, compare, moneyScale }) {
  const width = 720
  const height = 260
  const pad = { l: 72, r: 12, t: 16, b: 28 }
  const max = Math.max(1, ...series.map(row => row.value), ...(compare || []).map(row => row.value))
  const x = index => pad.l + (series.length <= 1 ? 0 : (index / (series.length - 1)) * (width - pad.l - pad.r))
  const y = value => pad.t + (height - pad.t - pad.b) * (1 - value / max)
  const ticks = [0, max / 2, max]
  const step = Math.max(1, Math.ceil(series.length / 10))
  const line = rows => smooth(rows.map((row, index) => ({ x: x(index), y: y(row.value) })))
  const label = value => (moneyScale ? compact(value) : Math.round(value).toLocaleString())
  return (
    <svg className="attr-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Report chart">
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} />
          <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end">{label(tick)}</text>
        </g>
      ))}
      <path d={line(series)} className="direct" />
      {compare && <path d={line(compare)} className="organic" />}
      {series.map((row, index) => index % step === 0 && (
        <text key={row.day} className="axis-label" x={x(index)} y={height - 6} textAnchor="middle">{shortLabel(row.day)}</text>
      ))}
    </svg>
  )
}

function Donut({ cents }) {
  const radius = 78
  const length = 2 * Math.PI * radius
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 220 220" role="img" aria-label={money(cents)}>
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#d7ecff" strokeWidth="22" />
        {cents > 0 && <circle cx="110" cy="110" r={radius} fill="none" stroke="#2f9bff" strokeWidth="22" strokeDasharray={`${length} ${length}`} transform="rotate(-90 110 110)" />}
        <text x="110" y="116" textAnchor="middle">{compact(cents)}</text>
      </svg>
      <p className="legend"><i className="swatch direct" /> None <b>{compact(cents)}</b></p>
    </div>
  )
}

function QueryCard({ spec, headline }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="query-card">
      <strong>{headline}</strong>
      {open && (
        <pre>
          <span className="kw">FROM</span> {spec.from}{'\n'}
          <span className="kw">SHOW</span> {spec.show}
          {spec.where ? `\nWHERE ${spec.where}` : ''}
          {spec.timeseries ? `\nTIMESERIES ${spec.timeseries}` : ''}
        </pre>
      )}
      <button type="button" className="text-link" onClick={() => setOpen(value => !value)}>{open ? 'Hide query' : 'Refine query'}</button>
    </section>
  )
}

function ReportView({ report, onOpen, onDeleted }) {
  const [orders] = useJson('/api/orders')
  const [lines] = useJson('/api/order-lines')
  const spec = specFor(report)
  const [range, setRange] = useState(spec.range)
  const [compareOn, setCompareOn] = useState(spec.compare === 'previous')
  const [viz, setViz] = useState(spec.viz)
  const [controls, setControls] = useState(true)
  const [auto, setAuto] = useState(false)
  const [cohorts, setCohorts] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const period = span(range)
  const prior = previous(period)
  const paid = (orders || []).filter(order => order.payment === 'paid')
  const salesSeries = byDay(orders || [], period, order => order.total)
  const itemSeries = byDay(lines || [], period, line => line.qty)
  const priorItems = byDay(lines || [], prior, line => line.qty)
  const paymentTotal = paid.filter(order => {
    const day = order.created_at.slice(0, 10)
    return day >= period.start && day <= period.end
  }).reduce((sum, order) => sum + order.total, 0)
  const salesTotal = salesSeries.reduce((sum, row) => sum + row.value, 0)
  const itemTotal = itemSeries.reduce((sum, row) => sum + row.value, 0)
  const sessionInRange = SESSION.date >= period.start && SESSION.date <= period.end
  const moneyScale = spec.kind === 'sales' || spec.kind === 'payments'
  const headline = spec.kind === 'payments'
    ? `${money(paymentTotal)} ${spec.metric}`
    : spec.kind === 'items'
      ? `${itemTotal.toLocaleString()} ${spec.metric}`
      : spec.kind === 'sales'
        ? `${money(salesTotal)} ${spec.metric}`
        : spec.kind === 'location' || spec.kind === 'sessions'
          ? `${sessionInRange ? 1 : 0} Sessions`
          : `No ${spec.metric.toLowerCase()} in this range`
  const refreshed = TODAY.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const exportRows = () => {
    if (spec.kind === 'payments') csv([['Payment method', 'Net payments'], ['Summary', money(paymentTotal)], ['None', money(paymentTotal)]], 'net-payments.csv', { excel: true })
    else if (spec.kind === 'location') csv([['Country', 'Region', 'City', 'Visitors', 'Sessions'], ['Kenya', 'Nairobi County', 'Nairobi', sessionInRange ? 1 : 0, sessionInRange ? 1 : 0]], 'sessions-by-location.csv', { excel: true })
    else if (spec.kind === 'items') csv([['Day', 'Quantity ordered'], ...itemSeries.map(row => [row.day, row.value])], 'items-ordered.csv', { excel: true })
    else csv([['Day', spec.metric], ...salesSeries.map(row => [row.day, moneyScale ? money(row.value) : row.value])], 'report.csv', { excel: true })
  }
  const remove = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    fetch(`/api/reports/${report.id}`, { method: 'DELETE' }).then(() => { onDeleted(); onOpen('reports') })
  }
  const series = spec.kind === 'items' ? itemSeries : spec.kind === 'sessions' ? dates(period).map(day => ({ day, value: day === SESSION.date ? 1 : 0 })) : salesSeries
  return (
    <div className="order-page">
      <div className="orders-top">
        <div className="crumb">
          <button type="button" className="text-link" onClick={() => onOpen('reports')}>Reports</button>
          <span>/</span> <strong>{report.name}</strong>
          <span className="muted">Last refreshed: {refreshed}</span>
        </div>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setAuto(value => !value)}>{auto ? 'Auto refresh on' : 'Enable auto refresh'}</button>
          <button type="button" className="ghost" onClick={exportRows}>Export</button>
          <button type="button" className="ghost" onClick={() => globalThis.print()}><Printer size={14} /> Print</button>
          <button type="button" className="ghost" onClick={remove}>{confirmDelete ? 'Confirm delete' : 'Delete'}</button>
        </div>
      </div>
      <div className={controls ? 'explore' : ''}>
        <div>
          <div className="explore-tools">
            <select aria-label="Date range" value={range} onChange={e => setRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <select aria-label="Comparison" value={compareOn ? 'previous' : 'none'} onChange={e => setCompareOn(e.target.value === 'previous')}>
              <option value="none">No comparison</option>
              <option value="previous">{shortLabel(prior.start)}–{shortLabel(prior.end)}</option>
            </select>
            <span className="date-chip">Kenyan Shilling (KES)</span>
            <button type="button" className="ghost" onClick={() => setControls(value => !value)}>Controls</button>
          </div>
          <QueryCard spec={spec} headline={headline} />
          <section className="chart-card report-chart">
            <h2>{spec.metric}</h2>
            {viz === 'donut' && <Donut cents={spec.kind === 'payments' ? paymentTotal : salesTotal} />}
            {viz === 'horizontal' && (
              sessionInRange
                ? <div className="hbar-card"><p>Kenya · Nairobi County · Nairobi</p><div className="hbar" /></div>
                : <p className="muted chart-empty">No sessions in this date range.</p>
            )}
            {viz === 'line' && (
              <>
                <p>{spec.kind === 'items' ? itemTotal.toLocaleString() : moneyScale ? money(series.reduce((sum, row) => sum + row.value, 0)) : series.reduce((sum, row) => sum + row.value, 0).toLocaleString()}</p>
                <LineChart series={series} compare={compareOn && spec.kind === 'items' ? priorItems : null} moneyScale={moneyScale && spec.kind !== 'items'} />
                <p className="legend"><i className="swatch direct" /> {shortLabel(period.start)}–{shortLabel(period.end)}{compareOn && <><i className="swatch organic" /> {shortLabel(prior.start)}–{shortLabel(prior.end)}</>}</p>
              </>
            )}
          </section>
          <div className="sheet report-table">
            {spec.kind === 'payments' && (
              <table>
                <thead><tr><th>Payment method</th><th>Net payments</th></tr></thead>
                <tbody>
                  <tr><td>Summary</td><td>{money(paymentTotal)}</td></tr>
                  <tr><td>None</td><td>{money(paymentTotal)}</td></tr>
                </tbody>
              </table>
            )}
            {spec.kind === 'location' && (
              <table>
                <thead><tr><th>Session country</th><th>Session region</th><th>Session city</th><th>Online store visitors</th><th>Sessions</th></tr></thead>
                <tbody>
                  <tr><td>Summary</td><td /><td /><td>{sessionInRange ? 1 : 0}</td><td>{sessionInRange ? 1 : 0}</td></tr>
                  {sessionInRange && <tr><td>Kenya</td><td>Nairobi County</td><td>Nairobi</td><td>1</td><td>1</td></tr>}
                </tbody>
              </table>
            )}
            {(spec.kind === 'items' || spec.kind === 'sales' || spec.kind === 'sessions' || spec.kind === 'empty') && (
              <table>
                <thead><tr><th>Day</th><th>{spec.metric}</th></tr></thead>
                <tbody>
                  <tr><td>{dayLabel(period.start)}–{dayLabel(period.end)}</td><td>{spec.kind === 'items' ? itemTotal.toLocaleString() : moneyScale ? money(salesTotal) : series.reduce((sum, row) => sum + row.value, 0).toLocaleString()}</td></tr>
                  {compareOn && spec.kind === 'items' && <tr><td>{dayLabel(prior.start)}–{dayLabel(prior.end)}</td><td>{priorItems.reduce((sum, row) => sum + row.value, 0).toLocaleString()}</td></tr>}
                  {series.map((row, index) => (
                    <tr key={row.day}>
                      <td>{dayLabel(row.day)}{compareOn && spec.kind === 'items' ? <><br />{dayLabel(priorItems[index]?.day || row.day)}</> : null}</td>
                      <td>{spec.kind === 'sales' ? money(row.value) : row.value.toLocaleString()}{compareOn && spec.kind === 'items' ? <><br />{(priorItems[index]?.value || 0).toLocaleString()}</> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {controls && (
          <aside>
            <div className="viz-tabs">
              <button type="button" className={cohorts ? '' : 'on'} onClick={() => setCohorts(false)}>Freeform</button>
              <button type="button" className={cohorts ? 'on' : ''} onClick={() => setCohorts(true)}>Cohorts</button>
            </div>
            {cohorts ? <p className="muted">Cohorts group customers by the month of their first order. This report is a freeform exploration.</p> : (
              <>
                <section className="side-block">
                  <h3>Metrics</h3>
                  {(spec.metrics || [spec.metric]).map(metric => (
                    <label key={metric} className="metric-check"><input type="checkbox" checked readOnly />{metric}</label>
                  ))}
                </section>
                <section className="side-block">
                  <h3>Dimensions</h3>
                  {(spec.dimensions || [spec.dimension]).map(dimension => <p key={dimension}>{dimension}</p>)}
                </section>
                <section className="side-block">
                  <h3>Visualization</h3>
                  <select aria-label="Visualization" value={viz} onChange={e => setViz(e.target.value)}>
                    <option value="line">Line</option>
                    <option value="donut">Donut</option>
                    <option value="horizontal">Simple horizontal</option>
                  </select>
                </section>
                {spec.filters && (
                  <section className="side-block">
                    <h3>Filters</h3>
                    {spec.filters.map(filter => <p key={filter}>{filter}</p>)}
                  </section>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

export function Reports({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/reports')
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState(() => new Set())
  const [authors, setAuthors] = useState(() => new Set())
  const [openFilter, setOpenFilter] = useState('')
  const [creating, setCreating] = useState(focus.create === '1')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Sales')
  const [error, setError] = useState('')
  const picked = (rows || []).find(row => String(row.id) === String(focus.report))
  const authorList = [...new Set((rows || []).map(row => row.created_by))]
  const visible = useMemo(() => (rows || []).filter(row => {
    const matchesName = row.name.toLowerCase().includes(query.trim().toLowerCase())
    const matchesCategory = categories.size === 0 || categories.has(row.category)
    const matchesAuthor = authors.size === 0 || authors.has(row.created_by)
    return matchesName && matchesCategory && matchesAuthor
  }), [rows, query, categories, authors])
  const toggle = (set, value) => set(current => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })
  const save = event => {
    event.preventDefault()
    fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not create report')
      const report = await response.json()
      setCreating(false)
      setName('')
      reload()
      onOpen('reports', { report: report.id })
    }).catch(err => setError(err.message))
  }
  if (picked) return <ReportView key={picked.id} report={picked} onOpen={onOpen} onDeleted={reload} />
  return (
    <>
      <div className="orders-top">
        <h1>Reports</h1>
        <button type="button" className="solid" onClick={() => setCreating(true)}>New exploration</button>
      </div>
      <div className="sheet">
        <div className="toolbar">
          <label className="finder"><Search size={15} /><input placeholder="Search reports" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <button type="button" className="ghost" onClick={() => setOpenFilter(value => value === 'author' ? '' : 'author')}>Created by <ChevronDown size={14} /></button>
          <button type="button" className="ghost" onClick={() => setOpenFilter(value => value === 'category' ? '' : 'category')}>Category <ChevronDown size={14} /></button>
          {openFilter === 'category' && (
            <div className="popover">
              {CATEGORIES.map(item => (
                <label key={item}><input type="checkbox" checked={categories.has(item)} onChange={() => toggle(setCategories, item)} /> {item}</label>
              ))}
              <button type="button" className="text-link" onClick={() => setCategories(new Set())}>Clear</button>
            </div>
          )}
          {openFilter === 'author' && (
            <div className="popover">
              {authorList.map(item => (
                <label key={item}><input type="checkbox" checked={authors.has(item)} onChange={() => toggle(setAuthors, item)} /> {item}</label>
              ))}
              <button type="button" className="text-link" onClick={() => setAuthors(new Set())}>Clear</button>
            </div>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Last viewed <ChevronDown size={12} className="sort-mark" /></th>
                <th>Created by</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id} className="clickable" onClick={() => onOpen('reports', { report: row.id })}>
                  <td>{row.name}</td>
                  <td><span className="quiet-tag">{row.category}</span></td>
                  <td>{viewed(row.last_viewed)}</td>
                  <td><span className="creator"><ShoppingBag size={14} />{row.created_by}</span></td>
                </tr>
              ))}
              {rows && visible.length === 0 && <tr><td className="muted" colSpan={4}>No reports match that search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {creating && (
        <Modal title="New exploration" onClose={() => setCreating(false)}>
          <form className="modal-form" onSubmit={save}>
            <label>Name<input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
            <label>Category
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className="solid">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
