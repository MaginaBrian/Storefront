import { useEffect, useMemo, useRef, useState } from 'react'
import { Columns3, Search } from 'lucide-react'
import { Tag } from '../components/Tag.jsx'
import { useJson } from '../lib/api.js'
import { money } from '../lib/money.js'
import ExportOrders from './ExportOrders.jsx'
import { formatWhen } from './time.js'

const ORDER_COLS = [
  ['fulfill', 'Fulfill by'],
  ['channel', 'Channel'],
  ['payment', 'Payment status'],
  ['fulfillment', 'Fulfillment status'],
  ['items', 'Items'],
  ['delivery', 'Delivery status'],
  ['method', 'Delivery method'],
]

export default function OrdersList({ onChanged, onOpen, focus = {} }) {
  const [rows, reload, error] = useJson('/api/orders')
  const [summary, reloadSummary] = useJson('/api/orders/summary')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('desc')
  const [picked, setPicked] = useState(() => new Set())
  const [cols, setCols] = useState(() => Object.fromEntries(ORDER_COLS.map(([k]) => [k, true])))
  const [colsOpen, setColsOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const headRef = useRef(null)

  useEffect(() => {
    if (!colsOpen) return
    const close = e => {
      if (!e.target.closest('.popover') && !e.target.closest('[aria-label="Choose columns"]')) setColsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [colsOpen])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows || []).filter(r => {
      if (filter === 'pending' && r.payment !== 'pending') return false
      if (filter === 'paid' && r.payment !== 'paid') return false
      if (filter === 'unfulfilled' && r.fulfillment !== 'unfulfilled') return false
      if (filter === 'fulfilled' && r.fulfillment !== 'fulfilled') return false
      if (focus.channel && r.channel !== focus.channel) return false
      if (focus.customer && r.customer !== focus.customer) return false
      if (!q) return true
      return [r.id, r.customer, r.channel, r.delivery_method].join(' ').toLowerCase().includes(q)
    }).sort((a, b) => sort === 'asc' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  }, [rows, query, filter, sort, focus.channel, focus.customer])

  const pickedShown = shown.filter(r => picked.has(r.id)).length
  const allPicked = shown.length > 0 && pickedShown === shown.length
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = pickedShown > 0 && !allPicked
  }, [pickedShown, allPicked])

  const selected = (rows || []).find(r => String(r.id) === String(focus.order))
  const [related, setRelated] = useState(null)
  const [channels, setChannels] = useState([])
  useEffect(() => {
    if (!selected?.customer) { setRelated(null); return }
    fetch(`/api/profile?customer=${encodeURIComponent(selected.customer)}`).then(r => r.json()).then(setRelated)
  }, [selected?.id, selected?.customer])
  useEffect(() => {
    if (!focus.channel) return
    fetch('/api/analytics').then(r => r.json()).then(d => setChannels(d.channels || []))
  }, [focus.channel])
  useEffect(() => {
    document.querySelector('tr.picked')?.scrollIntoView({ block: 'nearest' })
  }, [focus.order])
  const fromDraft = related?.drafts?.find(d => String(d.order_id) === String(selected?.id))
  const channelStat = channels.find(c => c.name === focus.channel)
  const metrics = summary || { orders: 0, items: 0, reversals: 0, fulfilled: 0, delivered: 0 }
  const emptyNote = focus.channel ? `No recorded orders for ${focus.channel} yet.`
    : focus.customer ? `No orders for ${focus.customer}.` : 'No orders match this search.'

  return (
    <>
      <div className="orders-top">
        <h1>Orders</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setExporting(true)}>Export</button>
          <button type="button" className="solid" onClick={() => onOpen('drafts', { create: '1', customer: focus.customer || '' })}>Create order</button>
        </div>
      </div>
      {selected && (
        <section className="handoff">
          <div>
            <h2>Order #{selected.id}</h2>
            <p>{money(selected.total)} · {selected.items.toLocaleString()} items · {formatWhen(selected.created_at)}</p>
            <p>{selected.payment === 'paid' ? 'Paid' : 'Payment pending'} · {selected.fulfillment} · {selected.delivery_method}</p>
          </div>
          <div className="handoff-links">
            <button type="button" className="ghost" onClick={() => onOpen('customers', { customer: selected.customer })}>{selected.customer}</button>
            <button type="button" className="ghost" onClick={() => onOpen('orders', { channel: selected.channel })}>{selected.channel}</button>
            {fromDraft && <button type="button" className="ghost" onClick={() => onOpen('drafts', { draft: fromDraft.id })}>From draft #{fromDraft.id}</button>}
            {related?.customer?.email && <span className="muted">{related.customer.email} · {related.customer.location}</span>}
          </div>
        </section>
      )}
      {focus.channel && (
        <section className="handoff">
          <div>
            <h2>{focus.channel}</h2>
            <p>{channelStat ? `${channelStat.orders.toLocaleString()} orders in this channel · KES ${channelStat.sales.toLocaleString()}` : 'Orders placed in this channel'}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('orders')}>Show all orders</button>
        </section>
      )}
      {focus.customer && !selected && (
        <section className="handoff">
          <div><h2>{focus.customer}</h2><p>Orders for this customer</p></div>
          <button type="button" className="ghost" onClick={() => onOpen('customers', { customer: focus.customer })}>Customer profile</button>
        </section>
      )}
      <section className="metrics" aria-label="Today">
        <div className="metric period"><span>Today</span></div>
        {[['Orders', metrics.orders], ['Items ordered', metrics.items.toLocaleString()], ['Sales reversals', metrics.reversals ? money(metrics.reversals) : 'KES 0'], ['Orders fulfilled', metrics.fulfilled], ['Orders delivered', metrics.delivered]].map(([k, v]) => (
          <div className="metric" key={k}><span>{k}</span><strong>{v}</strong><i className="tick" /></div>
        ))}
      </section>
      <div className="sheet">
        <div className="toolbar">
          <select aria-label="Filter orders" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Payment pending</option>
            <option value="paid">Paid</option>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="fulfilled">Fulfilled</option>
          </select>
          <label className="finder"><Search size={15} /><input placeholder="Search and filter" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <button type="button" className="icon-btn" aria-label="Choose columns" aria-expanded={colsOpen} onClick={() => setColsOpen(o => !o)}><Columns3 size={16} /></button>
          {colsOpen && (
            <div className="popover">
              {ORDER_COLS.map(([key, label]) => (
                <label key={key}><input type="checkbox" checked={cols[key]} onChange={() => setCols(c => ({ ...c, [key]: !c[key] }))} />{label}</label>
              ))}
            </div>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input ref={headRef} type="checkbox" aria-label="Select all orders" checked={allPicked} onChange={e => setPicked(e.target.checked ? new Set(shown.map(r => r.id)) : new Set())} /></th>
                <th>Order</th>
                <th><button type="button" className="sort" onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}>Date {sort === 'desc' ? '↓' : '↑'}</button></th>
                <th>Customer</th>
                {cols.fulfill && <th>Fulfill by</th>}
                {cols.channel && <th>Channel</th>}
                <th>Total</th>
                {cols.payment && <th>Payment status</th>}
                {cols.fulfillment && <th>Fulfillment status</th>}
                {cols.items && <th>Items</th>}
                {cols.delivery && <th>Delivery status</th>}
                {cols.method && <th>Delivery method</th>}
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={12} className="muted">{error}</td></tr>}
              {!error && rows && shown.length === 0 && <tr><td colSpan={12} className="muted">{emptyNote}</td></tr>}
              {shown.map(r => (
                <tr key={r.id} className={`clickable ${String(r.id) === String(focus.order) ? 'picked' : ''}`} onClick={() => onOpen('orders', { order: r.id })}>
                  <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select order ${r.id}`} checked={picked.has(r.id)} onChange={() => setPicked(prev => {
                    const next = new Set(prev)
                    next.has(r.id) ? next.delete(r.id) : next.add(r.id)
                    return next
                  })} /></td>
                  <td><button type="button" className="link text-link" onClick={() => onOpen('orders', { order: r.id })}>#{r.id}</button></td>
                  <td>{formatWhen(r.created_at)}</td>
                  <td><button type="button" className="text-link" onClick={e => { e.stopPropagation(); onOpen('customers', { customer: r.customer }) }}>{r.customer}</button></td>
                  {cols.fulfill && <td className="muted">{r.fulfill_by || '—'}</td>}
                  {cols.channel && <td><button type="button" className="text-link" onClick={e => { e.stopPropagation(); onOpen('orders', { channel: r.channel }) }}>{r.channel}</button></td>}
                  <td>{money(r.total)}</td>
                  {cols.payment && <td>{r.payment === 'paid' ? <Tag kind="quiet">Paid</Tag> : <Tag kind="pending">Payment pending</Tag>}</td>}
                  {cols.fulfillment && <td>{r.fulfillment === 'fulfilled' ? <Tag kind="quiet">Fulfilled</Tag> : <Tag kind="wait">Unfulfilled</Tag>}</td>}
                  {cols.items && <td>{r.items.toLocaleString()} items</td>}
                  {cols.delivery && <td className="muted">{r.delivery_status || '—'}</td>}
                  {cols.method && <td>{r.delivery_method}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/orders" target="_blank" rel="noreferrer">Learn more about orders</a>
      {exporting && (
        <ExportOrders
          rows={rows || []}
          shown={shown}
          picked={picked}
          searching={Boolean(query.trim()) || filter !== 'all' || Boolean(focus.customer) || Boolean(focus.channel)}
          onClose={() => setExporting(false)}
        />
      )}
    </>
  )
}
