import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Printer, Search, ShoppingBag } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'
import { useJson } from '../lib/api.js'

const TODAY = new Date()
const CATEGORIES = ['Acquisition', 'Behavior', 'Customers', 'Finances', 'Fraud', 'Inventory', 'Marketing', 'Orders', 'Performance', 'Profit Margin', 'Retail Sales', 'Sales', 'Store']

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
  'Chargeback rate': {
    kind: 'rate', viz: 'line', range: '30', compare: 'none', metric: 'Chargeback rate', dimension: 'Day',
    from: 'payments', show: 'chargeback_rate', timeseries: 'day',
    note: 'No chargebacks in this range.',
  },
  'Cost of goods sold by order': {
    kind: 'by-order', field: 'cogs', viz: 'table', range: '30', compare: 'none', metric: 'Cost of goods sold', dimension: 'Order',
    from: 'sales', show: 'cost_of_goods_sold',
    note: 'These orders have no product cost on file.',
  },
  'Discounts by order': {
    kind: 'by-order', field: 'discount', viz: 'table', range: '30', compare: 'none', metric: 'Discounts', dimension: 'Order',
    from: 'sales', show: 'discounts',
    note: 'No discount was applied to these orders.',
  },
  'Finance summary': {
    kind: 'summary', summary: 'finance', viz: 'table', range: '30', compare: 'none', metric: 'Total sales', dimension: 'Sale component',
    metrics: ['Gross sales', 'Discounts', 'Returns', 'Net sales', 'Shipping charges', 'Taxes', 'Total sales'],
    from: 'sales', show: 'gross_sales, discounts, returns, net_sales, shipping, taxes, total_sales',
    note: 'Taxes are included in total sales.',
  },
  'Gross payments from Shopify Payments': {
    kind: 'shopify', viz: 'donut', range: '30', compare: 'none', metric: 'Gross payments', dimension: 'Payment gateway',
    from: 'payments', show: 'gross_payments', where: "payment_gateway = 'shopify_payments'",
    note: 'No payments used Shopify Payments.',
  },
  'Gross profit breakdown': {
    kind: 'summary', summary: 'profit', viz: 'table', range: '30', compare: 'none', metric: 'Gross profit', dimension: 'Sale component',
    metrics: ['Gross sales', 'Discounts', 'Returns', 'Net sales', 'Cost of goods sold', 'Gross profit'],
    from: 'sales', show: 'net_sales, cost_of_goods_sold, gross_profit',
    note: 'Gross profit equals net sales because no product cost is stored.',
  },
  'Gross profit by order': {
    kind: 'by-order', field: 'profit', viz: 'table', range: '30', compare: 'none', metric: 'Gross profit', dimension: 'Order',
    from: 'sales', show: 'gross_profit',
  },
  'Gross sales by order': {
    kind: 'by-order', field: 'gross', viz: 'table', range: '30', compare: 'none', metric: 'Gross sales', dimension: 'Order',
    from: 'sales', show: 'gross_sales',
  },
  'Managed Markets taxes': {
    kind: 'summary', summary: 'markets', viz: 'table', range: '30', compare: 'none', metric: 'Managed Markets taxes', dimension: 'Market',
    from: 'sales', show: 'taxes', where: "sale_market_type = 'managed'",
    note: 'No Managed Markets orders in this range.',
  },
  'Net payments by gateway': {
    kind: 'payments', viz: 'donut', range: '30', compare: 'none', metric: 'Net payments', dimension: 'Payment gateway',
    from: 'payments', show: 'net_payments',
  },
  'Net payments by order': {
    kind: 'by-order', field: 'netpay', viz: 'table', range: '30', compare: 'none', metric: 'Net payments', dimension: 'Order',
    from: 'payments', show: 'net_payments',
  },
  'Net payments over time': {
    kind: 'payments-time', viz: 'line', range: '30', compare: 'none', metric: 'Net payments', dimension: 'Day',
    from: 'payments', show: 'net_payments', timeseries: 'day WITH TOTALS',
  },
  'Net sales by order': {
    kind: 'by-order', field: 'netsales', viz: 'table', range: '30', compare: 'none', metric: 'Net sales', dimension: 'Order',
    from: 'sales', show: 'net_sales',
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
  if (name.includes('bought together') || name.includes('same order')) {
    return { kind: 'pairs', viz: 'table', range: '90', compare: 'none', metric: 'Orders', dimension: 'Products', from: 'sales', show: 'orders' }
  }
  if (name.includes('device')) {
    return { kind: 'device', viz: 'table', range: '30', compare: 'none', metric: 'Sessions', dimension: 'Device', from: 'sessions', show: 'sessions' }
  }
  if (name.includes('landing')) {
    return { kind: 'landing', viz: 'table', range: '30', compare: 'none', metric: 'Sessions', dimension: 'Landing page', from: 'sessions', show: 'sessions' }
  }
  if (name.includes('by product') || name.includes('sell-through')) {
    return { kind: 'product', viz: 'table', range: '30', compare: 'none', metric: 'Total sales', dimension: 'Product', from: 'sales', show: 'total_sales' }
  }
  if (name.includes('channel')) {
    return { kind: 'channel', viz: 'table', range: '30', compare: 'none', metric: 'Total sales', dimension: 'Channel', from: 'sales', show: 'total_sales' }
  }
  if (name.includes('fulfilled')) {
    return { kind: 'fulfilled', viz: 'table', range: '30', compare: 'none', metric: 'Orders fulfilled', dimension: 'Order', from: 'sales', show: 'orders' }
  }
  if (name.includes('average order')) {
    return { kind: 'aov', viz: 'line', range: '30', compare: 'none', metric: 'Average order value', dimension: 'Day', from: 'sales', show: 'average_order_value', timeseries: 'day' }
  }
  if (name.includes('session') || name.includes('visitor') || name.includes('bounce') || name.includes('referrer')) {
    return { kind: 'sessions', viz: 'line', range: '30', compare: 'none', metric: 'Sessions', dimension: 'Day', from: 'sessions', show: 'sessions' }
  }
  if (name.includes('item') || name.includes('quantity')) {
    return { kind: 'items', viz: 'line', range: '30', compare: 'none', metric: 'Quantity ordered', dimension: 'Day', from: 'sales', show: 'quantity_ordered', timeseries: 'day' }
  }
  if (name.includes('payment')) {
    return { kind: 'payments', viz: 'donut', range: '30', compare: 'none', metric: 'Net payments', dimension: 'Payment method', from: 'payments', show: 'net_payments' }
  }
  if (name.includes('sale') || name.includes('profit') || report.category === 'Sales' || report.category === 'Orders') {
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

function Donut({ cents, label = 'None' }) {
  const radius = 78
  const length = 2 * Math.PI * radius
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 220 220" role="img" aria-label={money(cents)}>
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#d7ecff" strokeWidth="22" />
        {cents > 0 && <circle cx="110" cy="110" r={radius} fill="none" stroke="#2f9bff" strokeWidth="22" strokeDasharray={`${length} ${length}`} transform="rotate(-90 110 110)" />}
        <text x="110" y="116" textAnchor="middle">{compact(cents)}</text>
      </svg>
      <p className="legend"><i className="swatch direct" /> {label} <b>{compact(cents)}</b></p>
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
  const [stats] = useJson(`/api/analytics?range=${range}`)
  useEffect(() => {
    fetch(`/api/reports/${report.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viewed: true }),
    }).catch(() => {})
  }, [report.id])
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
  const sessions = stats?.sessions || 0
  const sessionSeries = (stats?.session_series || []).map(row => ({ day: row.day, value: row.value }))
  const paidSeries = byDay(paid, period, order => order.total)
  const inPeriod = (orders || []).filter(order => {
    const day = order.created_at.slice(0, 10)
    return day >= period.start && day <= period.end
  })
  const includedTax = inPeriod.reduce((sum, order) => sum + Math.round(order.total * 16 / 116), 0)
  const orderRows = inPeriod.filter(order => spec.field !== 'netpay' || order.payment === 'paid').map(order => ({
    ...order,
    value: spec.field === 'cogs' || spec.field === 'discount' ? 0 : order.total,
  }))
  const orderTotal = orderRows.reduce((sum, order) => sum + order.value, 0)
  const summaryRows = spec.summary === 'profit'
    ? [['Gross sales', salesTotal], ['Discounts', 0], ['Returns', 0], ['Net sales', salesTotal], ['Cost of goods sold', 0], ['Gross profit', salesTotal]]
    : spec.summary === 'markets'
      ? [['Managed Markets taxes', 0]]
      : [['Gross sales', salesTotal], ['Discounts', 0], ['Returns', 0], ['Net sales', salesTotal], ['Shipping charges', 0], ['Taxes', includedTax], ['Total sales', salesTotal]]
  const summaryTotal = summaryRows[summaryRows.length - 1][1]
  const moneyScale = spec.kind === 'sales' || spec.kind === 'payments' || spec.kind === 'payments-time' || spec.kind === 'by-order' || spec.kind === 'summary' || spec.kind === 'shopify' || spec.kind === 'aov'
  const headline = spec.kind === 'pairs'
    ? `${(stats?.bought_together || []).length} product pairs`
    : spec.kind === 'channel'
      ? `${money(stats?.gross_sales || 0)} by channel`
      : spec.kind === 'product'
        ? `${(stats?.by_product || []).length} products`
        : spec.kind === 'device' || spec.kind === 'landing' || spec.kind === 'location' || spec.kind === 'sessions'
          ? `${sessions} sessions`
          : spec.kind === 'fulfilled'
            ? `${stats?.orders_fulfilled || 0} orders fulfilled`
            : spec.kind === 'aov'
              ? `${money(stats?.aov || 0)} average order value`
              : spec.kind === 'payments'
    ? `${money(paymentTotal)} ${spec.metric}`
    : spec.kind === 'shopify'
      ? `${money(0)} ${spec.metric}`
      : spec.kind === 'items'
        ? `${itemTotal.toLocaleString()} ${spec.metric}`
        : spec.kind === 'sales' || spec.kind === 'payments-time'
          ? `${money(spec.kind === 'payments-time' ? paymentTotal : salesTotal)} ${spec.metric}`
          : spec.kind === 'by-order'
            ? `${money(orderTotal)} ${spec.metric}`
            : spec.kind === 'summary'
              ? `${money(summaryTotal)} ${spec.metric}`
              : spec.kind === 'rate'
                ? `0% ${spec.metric}`
                : `No ${spec.metric.toLowerCase()} in this range`
  const refreshed = TODAY.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const exportRows = () => {
    if (spec.kind === 'payments') csv([[spec.dimension, spec.metric], ['Summary', money(paymentTotal)], ['None', money(paymentTotal)]], 'net-payments.csv', { excel: true })
    else if (spec.kind === 'shopify') csv([['Payment gateway', 'Gross payments'], ['Shopify Payments', money(0)]], 'shopify-payments.csv', { excel: true })
    else if (spec.kind === 'location') csv([['Location', 'Sessions'], ...(stats?.locations || []).map(row => [row.name, row.count])], 'sessions-by-location.csv', { excel: true })
    else if (spec.kind === 'pairs') csv([['Products', 'Orders'], ...(stats?.bought_together || []).map(row => [row.products.join(' + '), row.orders])], 'bought-together.csv', { excel: true })
    else if (spec.kind === 'channel') csv([['Channel', 'Total sales'], ...(stats?.by_channel || []).map(row => [row.name, money(row.value)])], 'sales-by-channel.csv', { excel: true })
    else if (spec.kind === 'product') csv([['Product', 'Quantity', 'Total sales'], ...(stats?.by_product || []).map(row => [row.name, row.qty, money(row.value)])], 'sales-by-product.csv', { excel: true })
    else if (spec.kind === 'items') csv([['Day', 'Quantity ordered'], ...itemSeries.map(row => [row.day, row.value])], 'items-ordered.csv', { excel: true })
    else if (spec.kind === 'by-order') csv([['Order', 'Customer', spec.metric], ...orderRows.map(order => [`#${order.id}`, order.customer, money(order.value)])], 'orders.csv', { excel: true })
    else if (spec.kind === 'summary') csv([['Component', 'Amount'], ...summaryRows.map(row => [row[0], money(row[1])])], 'summary.csv', { excel: true })
    else if (spec.kind === 'rate') csv([['Day', 'Chargeback rate'], ...rateSeries.map(row => [row.day, '0%'])], 'chargeback-rate.csv', { excel: true })
    else csv([['Day', spec.metric], ...series.map(row => [row.day, moneyScale ? money(row.value) : row.value])], 'report.csv', { excel: true })
  }
  const remove = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    fetch(`/api/reports/${report.id}`, { method: 'DELETE' }).then(() => { onDeleted(); onOpen('reports') })
  }
  const rateSeries = dates(period).map(day => ({ day, value: 0 }))
  const series = spec.kind === 'items' ? itemSeries : spec.kind === 'sessions' || spec.kind === 'device' || spec.kind === 'landing' ? sessionSeries : spec.kind === 'aov' ? (stats?.aov_series || []).map(row => ({ day: row.day, value: row.value })) : spec.kind === 'payments-time' || spec.field === 'netpay' ? paidSeries : spec.field === 'cogs' || spec.field === 'discount' ? rateSeries : spec.kind === 'rate' ? rateSeries : salesSeries
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
            {viz === 'donut' && <Donut cents={spec.kind === 'shopify' ? 0 : spec.kind === 'payments' ? paymentTotal : salesTotal} label={spec.kind === 'shopify' ? 'Shopify Payments' : 'None'} />}
            {viz === 'table' && !['pairs', 'channel', 'product', 'device', 'landing', 'fulfilled', 'location'].includes(spec.kind) && <p>{spec.kind === 'summary' ? money(summaryTotal) : money(orderTotal)}</p>}
            {viz === 'horizontal' && (
              (stats?.locations || []).length
                ? (stats.locations.map(row => <div className="hbar-card" key={row.name}><p>{row.name}</p><div className="hbar" /><b>{row.count}</b></div>))
                : <p className="muted chart-empty">No sessions in this date range.</p>
            )}
            {viz === 'line' && (
              <>
                <p>{spec.kind === 'rate' ? '0%' : spec.kind === 'items' ? itemTotal.toLocaleString() : moneyScale ? money(series.reduce((sum, row) => sum + row.value, 0)) : series.reduce((sum, row) => sum + row.value, 0).toLocaleString()}</p>
                <LineChart series={series} compare={compareOn && spec.kind === 'items' ? priorItems : null} moneyScale={moneyScale && spec.kind !== 'items'} />
                <p className="legend"><i className="swatch direct" /> {shortLabel(period.start)}–{shortLabel(period.end)}{compareOn && <><i className="swatch organic" /> {shortLabel(prior.start)}–{shortLabel(prior.end)}</>}</p>
              </>
            )}
            {spec.note && <p className="muted">{spec.note}</p>}
          </section>
          <div className="sheet report-table">
            {spec.kind === 'payments' && (
              <table>
                <thead><tr><th>{spec.dimension}</th><th>{spec.metric}</th></tr></thead>
                <tbody>
                  <tr><td>Summary</td><td>{money(paymentTotal)}</td></tr>
                  <tr><td>None</td><td>{money(paymentTotal)}</td></tr>
                </tbody>
              </table>
            )}
            {spec.kind === 'location' && (
              <table>
                <thead><tr><th>Location</th><th>Sessions</th></tr></thead>
                <tbody>
                  {(stats?.locations || []).map(row => <tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>)}
                  {stats && !(stats.locations || []).length && <tr><td colSpan={2}>No sessions in this date range.</td></tr>}
                </tbody>
              </table>
            )}
            {spec.kind === 'device' && (
              <table>
                <thead><tr><th>Device</th><th>Sessions</th></tr></thead>
                <tbody>{(stats?.devices || []).map(row => <tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>)}</tbody>
              </table>
            )}
            {spec.kind === 'landing' && (
              <table>
                <thead><tr><th>Landing page</th><th>Sessions</th></tr></thead>
                <tbody>{(stats?.landing_pages || []).map(row => <tr key={row.path}><td>{row.path}</td><td>{row.count}</td></tr>)}</tbody>
              </table>
            )}
            {spec.kind === 'channel' && (
              <table>
                <thead><tr><th>Channel</th><th>Total sales</th></tr></thead>
                <tbody>{(stats?.by_channel || []).map(row => <tr key={row.name}><td>{row.name}</td><td>{money(row.value)}</td></tr>)}</tbody>
              </table>
            )}
            {spec.kind === 'product' && (
              <table>
                <thead><tr><th>Product</th><th>Quantity</th><th>Total sales</th></tr></thead>
                <tbody>{(stats?.by_product || []).map(row => <tr key={row.name}><td>{row.name}</td><td>{row.qty.toLocaleString()}</td><td>{money(row.value)}</td></tr>)}</tbody>
              </table>
            )}
            {spec.kind === 'pairs' && (
              <table>
                <thead><tr><th>Products</th><th>Orders</th></tr></thead>
                <tbody>
                  {(stats?.bought_together || []).map(row => <tr key={row.products.join('|')}><td>{row.products.join(' + ')}</td><td>{row.orders}</td></tr>)}
                  {stats && !(stats.bought_together || []).length && <tr><td colSpan={2}>No order in this range contains more than one product.</td></tr>}
                </tbody>
              </table>
            )}
            {spec.kind === 'fulfilled' && (
              <table>
                <thead><tr><th>Order</th><th>Customer</th><th>Total</th></tr></thead>
                <tbody>
                  {(stats?.fulfilled_orders || []).map(order => (
                    <tr key={order.id}>
                      <td><button type="button" className="text-link" onClick={() => onOpen('orders', { order: order.id })}>#{order.id}</button></td>
                      <td>{order.customer}</td>
                      <td>{money(order.total)}</td>
                    </tr>
                  ))}
                  {stats && !(stats.fulfilled_orders || []).length && <tr><td colSpan={3}>No fulfilled orders in this date range.</td></tr>}
                </tbody>
              </table>
            )}
            {(spec.kind === 'items' || spec.kind === 'sales' || spec.kind === 'sessions' || spec.kind === 'empty' || spec.kind === 'rate' || spec.kind === 'payments-time' || spec.kind === 'aov') && (
              <table>
                <thead><tr><th>Day</th><th>{spec.metric}</th></tr></thead>
                <tbody>
                  <tr><td>{dayLabel(period.start)}–{dayLabel(period.end)}</td><td>{spec.kind === 'rate' ? '0%' : spec.kind === 'items' ? itemTotal.toLocaleString() : moneyScale ? money(series.reduce((sum, row) => sum + row.value, 0)) : series.reduce((sum, row) => sum + row.value, 0).toLocaleString()}</td></tr>
                  {compareOn && spec.kind === 'items' && <tr><td>{dayLabel(prior.start)}–{dayLabel(prior.end)}</td><td>{priorItems.reduce((sum, row) => sum + row.value, 0).toLocaleString()}</td></tr>}
                  {series.map((row, index) => (
                    <tr key={row.day}>
                      <td>{dayLabel(row.day)}{compareOn && spec.kind === 'items' ? <><br />{dayLabel(priorItems[index]?.day || row.day)}</> : null}</td>
                      <td>{spec.kind === 'rate' ? '0%' : spec.kind === 'items' || spec.kind === 'sessions' || spec.kind === 'empty' ? row.value.toLocaleString() : money(row.value)}{compareOn && spec.kind === 'items' ? <><br />{(priorItems[index]?.value || 0).toLocaleString()}</> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {spec.kind === 'shopify' && (
              <table>
                <thead><tr><th>Payment gateway</th><th>Gross payments</th></tr></thead>
                <tbody>
                  <tr><td>Summary</td><td>{money(0)}</td></tr>
                  <tr><td>Shopify Payments</td><td>{money(0)}</td></tr>
                </tbody>
              </table>
            )}
            {spec.kind === 'by-order' && (
              <table>
                <thead><tr><th>Order</th><th>Customer</th><th>{spec.metric}</th></tr></thead>
                <tbody>
                  <tr><td>Summary</td><td /><td>{money(orderTotal)}</td></tr>
                  {orderRows.map(order => (
                    <tr key={order.id}>
                      <td><button type="button" className="text-link" onClick={() => onOpen('orders', { order: order.id })}>#{order.id}</button></td>
                      <td>{order.customer}</td>
                      <td>{money(order.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {spec.kind === 'summary' && (
              <table>
                <thead><tr><th>Component</th><th>Amount</th></tr></thead>
                <tbody>
                  {summaryRows.map(row => <tr key={row[0]}><td>{row[0]}</td><td>{money(row[1])}</td></tr>)}
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
                    <option value="table">Table</option>
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
