import { useMemo, useState } from 'react'
import { ChevronDown, Search, ShoppingBag } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'

const CATEGORIES = ['Acquisition', 'Behavior', 'Customers', 'Finances', 'Fraud', 'Inventory', 'Marketing', 'Orders', 'Performance', 'Profit Margin', 'Retail Sales', 'Sales', 'Store']

const DEST = {
  Orders: ['orders'],
  Customers: ['customers'],
  Finances: ['orders'],
  Sales: ['orders'],
  Acquisition: ['live-view'],
  Behavior: ['analytics'],
}

function viewed(iso) {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Reports({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/reports')
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState(() => new Set())
  const [openFilter, setOpenFilter] = useState(false)
  const [creating, setCreating] = useState(focus.create === '1')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Sales')
  const [error, setError] = useState('')
  const picked = (rows || []).find(row => String(row.id) === String(focus.report))
  const visible = useMemo(() => (rows || []).filter(row => {
    const matchesName = row.name.toLowerCase().includes(query.trim().toLowerCase())
    const matchesCategory = categories.size === 0 || categories.has(row.category)
    return matchesName && matchesCategory
  }), [rows, query, categories])
  const toggle = value => setCategories(current => {
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
  if (picked) {
    const dest = DEST[picked.category] || ['analytics']
    return (
      <div className="order-page">
        <div className="crumb">
          <button type="button" className="text-link" onClick={() => onOpen('reports')}>Reports</button>
          <span>/</span> {picked.name}
        </div>
        <div className="orders-top"><h1>{picked.name}</h1></div>
        <article className="chart-card">
          <p>{picked.category} · {picked.created_by}{picked.last_viewed ? ` · Last viewed ${viewed(picked.last_viewed)}` : ''}</p>
          <p className="flat-note">No sales in this date range. Today is Oct 14, 2026, and the recorded orders are from September.</p>
          <button type="button" className="solid" onClick={() => onOpen(dest[0])}>Open {dest[0] === 'live-view' ? 'Live View' : dest[0][0].toUpperCase() + dest[0].slice(1)}</button>
        </article>
      </div>
    )
  }
  return (
    <>
      <div className="orders-top">
        <h1>Reports</h1>
        <button type="button" className="solid" onClick={() => setCreating(true)}>New exploration</button>
      </div>
      <div className="sheet">
        <div className="toolbar">
          <label className="finder"><Search size={15} /><input placeholder="Search reports" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <button type="button" className="ghost" onClick={() => setOpenFilter(value => !value)}>Category <ChevronDown size={14} /></button>
          {openFilter && (
            <div className="popover">
              {CATEGORIES.map(item => (
                <label key={item}><input type="checkbox" checked={categories.has(item)} onChange={() => toggle(item)} /> {item}</label>
              ))}
              <button type="button" className="text-link" onClick={() => setCategories(new Set())}>Clear</button>
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
                  <td className="activity">{viewed(row.last_viewed)}</td>
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
