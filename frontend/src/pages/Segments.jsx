import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, Copy, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { Tag } from '../components/Tag.jsx'
import { useJson } from '../lib/api.js'
import { money } from '../lib/money.js'

function activity(iso) {
  const date = new Date(`${iso}T00:00:00`)
  return `Created on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function share(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0%'
  return `${Number.isInteger(number) ? number : number.toFixed(2)}%`
}

function place(location) {
  if (!location) return '—'
  return location.includes(',') ? location : `${location}, Kenya`
}

function SegmentDetail({ id, onOpen }) {
  const [data, setData] = useState(null)
  const [missing, setMissing] = useState(false)
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setData(null)
    setMissing(false)
    fetch(`/api/segments/${id}`).then(async response => {
      const body = await response.json()
      if (ignore) return
      if (!response.ok) { setMissing(true); return }
      setData(body)
    }).catch(() => { if (!ignore) setMissing(true) })
    return () => { ignore = true }
  }, [id])

  useEffect(() => {
    if (!menu) return undefined
    const close = () => setMenu('')
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const act = action => {
    setBusy(true)
    setError('')
    return fetch(`/api/segments/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not update the segment')
      return body
    }).catch(err => { setError(err.message); throw err }).finally(() => setBusy(false))
  }

  if (missing) {
    return (
      <section className="panel">
        <h2>Segment</h2>
        <p>This segment is not saved.</p>
        <button type="button" className="ghost" onClick={() => onOpen('segments')}>All segments</button>
      </section>
    )
  }
  if (!data) return <p className="muted">Loading segment…</p>

  const segment = data.segment
  const customers = data.customers || []
  const shown = customers.filter(row => {
    const q = query.trim().toLowerCase()
    return !q || [row.name, row.email, row.location].join(' ').toLowerCase().includes(q)
  })
  const count = customers.length
  return (
    <div className="order-page">
      <div className="po-top">
        <button type="button" className="icon-btn" aria-label="Segments" onClick={() => onOpen('segments')}><ChevronLeft size={18} /></button>
        <div className="crumb segment-crumb">
          <button type="button" className="text-link" onClick={() => onOpen('segments')}>Segments</button>
          <span>/</span>
          <span>{segment.name}</span>
        </div>
        <div className="po-actions">
          <button type="button" className="ghost" disabled={busy} onClick={() => act('duplicate').then(body => onOpen('segments', { segment: body.id })).catch(() => {})}><Copy size={14} /> Duplicate</button>
          <div className="menu" onClick={e => e.stopPropagation()}>
            <button type="button" className="ghost" onClick={() => setMenu(menu === 'use' ? '' : 'use')}>Use segment <ChevronDown size={14} /></button>
            {menu === 'use' && (
              <div className="menu-pop">
                <button type="button" onClick={() => onOpen('discounts', { create: '1' })}>Create discount</button>
              </div>
            )}
          </div>
          <div className="menu" onClick={e => e.stopPropagation()}>
            <button type="button" className="ghost" onClick={() => setMenu(menu === 'more' ? '' : 'more')}>More actions <ChevronDown size={14} /></button>
            {menu === 'more' && (
              <div className="menu-pop">
                <button type="button" className="danger" disabled={busy} onClick={() => act('delete').then(() => onOpen('segments')).catch(() => {})}><Trash2 size={15} /> Delete segment</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="segment-count">
        <b>{count} {count === 1 ? 'customer' : 'customers'}</b>
        <span>{share(segment.percent)} of your customer base</span>
      </div>
      <p className="segment-blurb">{segment.description}</p>
      <div className="sheet">
        <div className="toolbar">
          <label className="finder"><Search size={15} /><input aria-label="Search customers" placeholder="Search customers" value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        {shown.length === 0 ? (
          <div className="segment-empty">
            <Search size={22} />
            <h2>No customers match this segment criteria</h2>
            <p>{query.trim() ? 'No saved customers match that search.' : 'None of the saved customers fit this segment.'}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer name</th>
                  <th>Email subscription</th>
                  <th>Location</th>
                  <th>Orders</th>
                  <th>Amount spent</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(row => (
                  <tr key={row.id}>
                    <td><button type="button" className="text-link" onClick={() => onOpen('customers', { customer: row.name })}>{row.name}</button></td>
                    <td>{row.subscribed ? '' : <Tag kind="quiet">Not subscribed</Tag>}</td>
                    <td>{place(row.location)}</td>
                    <td>{row.orders}</td>
                    <td>{money(row.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/customers" target="_blank" rel="noreferrer">Learn more about customers</a>
    </div>
  )
}

export function Segments({ onOpen, focus = {} }) {
  if (focus.segment) return <SegmentDetail key={focus.segment} id={focus.segment} onOpen={onOpen} />
  return <SegmentList onOpen={onOpen} />
}

function SegmentList({ onOpen }) {
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
                <tr key={row.id} className="clickable" onClick={() => onOpen('segments', { segment: row.id })}>
                  <td className="check" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${row.name}`} checked={picked.has(row.id)} onChange={() => toggle(row.id)} />
                  </td>
                  <td>{row.name}</td>
                  <td>{share(row.percent)}</td>
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
