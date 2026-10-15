import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { Tag } from '../components/Tag.jsx'
import { useJson } from '../lib/api.js'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'
import { formatWhen } from './time.js'

export default function DraftsList({ onOpen, focus = {} }) {
  const [rows, , error] = useJson('/api/drafts')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('desc')
  const [picked, setPicked] = useState(() => new Set())
  const headRef = useRef(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows || []).filter(r => {
      if (filter !== 'all' && r.status !== filter) return false
      if (focus.customer && r.customer !== focus.customer) return false
      if (!q) return true
      return [r.id, r.customer, r.po].join(' ').toLowerCase().includes(q)
    }).sort((a, b) => sort === 'asc' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  }, [rows, query, filter, sort, focus.customer])

  const pickedShown = shown.filter(r => picked.has(r.id)).length
  const allPicked = shown.length > 0 && pickedShown === shown.length
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = pickedShown > 0 && !allPicked
  }, [pickedShown, allPicked])

  return (
    <>
      <div className="orders-top">
        <h1>Drafts</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => csv([
            ['Draft order', 'PO number', 'Date', 'Customer', 'Status', 'Total'],
            ...shown.map(r => [r.id, r.po || '', formatWhen(r.created_at), r.customer, r.status, money(r.total)]),
          ], 'drafts.csv')}>Export</button>
          <button type="button" className="solid" onClick={() => onOpen('drafts', { create: '1', customer: focus.customer || '' })}>Create order</button>
        </div>
      </div>
      <div className="sheet">
        <div className="toolbar">
          <select aria-label="Filter drafts" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="open">Open</option>
          </select>
          <label className="finder"><Search size={15} /><input placeholder="Search and filter" value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input ref={headRef} type="checkbox" aria-label="Select all drafts" checked={allPicked} onChange={e => setPicked(e.target.checked ? new Set(shown.map(r => r.id)) : new Set())} /></th>
                <th>Draft order</th>
                <th>PO number</th>
                <th><button type="button" className="sort" onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}>Date {sort === 'desc' ? '↓' : '↑'}</button></th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={7} className="muted">{error}</td></tr>}
              {!error && rows && shown.length === 0 && <tr><td colSpan={7} className="muted">No drafts match this search.</td></tr>}
              {shown.map(r => (
                <tr key={r.id} className="clickable" onClick={() => onOpen('drafts', { draft: r.id })}>
                  <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select draft ${r.id}`} checked={picked.has(r.id)} onChange={() => setPicked(prev => {
                    const next = new Set(prev)
                    next.has(r.id) ? next.delete(r.id) : next.add(r.id)
                    return next
                  })} /></td>
                  <td><button type="button" className="link text-link" onClick={() => onOpen('drafts', { draft: r.id })}>#{r.id}</button></td>
                  <td>{r.po ? <FileText size={15} aria-label="PO note" /> : ''}</td>
                  <td>{formatWhen(r.created_at)}</td>
                  <td><button type="button" className="text-link" onClick={e => { e.stopPropagation(); onOpen('customers', { customer: r.customer }) }}>{r.customer}</button></td>
                  <td><Tag kind={r.status === 'open' ? 'open' : 'quiet'}>{r.status === 'open' ? 'Open' : 'Completed'}</Tag></td>
                  <td>{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/orders/create-orders" target="_blank" rel="noreferrer">Learn more about creating draft orders</a>
    </>
  )
}
