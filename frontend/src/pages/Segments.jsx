import { useState } from 'react'
import { ChevronDown, Search, ShoppingBag } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'

function activity(iso) {
  const date = new Date(`${iso}T00:00:00`)
  return `Created on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export function Segments({ onOpen }) {
  const [rows, reload] = useJson('/api/segments')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(() => new Set())
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const visible = (rows || []).filter(row => row.name.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = id => setPicked(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const save = event => {
    event.preventDefault()
    fetch('/api/segments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not create segment')
      setCreating(false)
      setName('')
      setError('')
      reload()
    }).catch(err => setError(err.message))
  }
  return (
    <>
      <div className="orders-top">
        <h1>Segments</h1>
        <button type="button" className="solid" onClick={() => setCreating(true)}>Create segment</button>
      </div>
      <div className="sheet">
        <div className="toolbar">
          <label className="finder"><Search size={15} /><input placeholder="Search segments" value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input type="checkbox" aria-label="Select segments" checked={visible.length > 0 && visible.every(row => picked.has(row.id))} onChange={e => setPicked(e.target.checked ? new Set(visible.map(row => row.id)) : new Set())} /></th>
                <th>Name</th>
                <th>% of customers</th>
                <th>Last activity <ChevronDown size={12} className="sort-mark" /></th>
                <th>Created by</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id} className="clickable" onClick={() => onOpen('customers', { segment: row.id })}>
                  <td className="check" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${row.name}`} checked={picked.has(row.id)} onChange={() => toggle(row.id)} />
                  </td>
                  <td>{row.name}</td>
                  <td>{row.percent}%</td>
                  <td className="activity">{activity(row.last_activity)}</td>
                  <td><span className="creator"><ShoppingBag size={14} />{row.created_by}</span></td>
                </tr>
              ))}
              {rows && visible.length === 0 && <tr><td className="muted" colSpan={5}>No segments match that search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/customers/customer-segmentation" target="_blank" rel="noreferrer">Learn more about segments</a>
      {creating && (
        <Modal title="Create segment" onClose={() => { setCreating(false); setError('') }}>
          <form className="modal-form" onSubmit={save}>
            <label>Name
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Customers in Nairobi" autoFocus />
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
