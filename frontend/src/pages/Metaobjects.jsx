import { useState } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'

export function Metaobjects({ focus = {}, onOpen }) {
  const [data, reload] = useJson('/api/metaobjects')
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const entries = data?.entries || []
  const definitions = (data?.definitions || []).filter(row => row.name.toLowerCase().includes(query.trim().toLowerCase()))
  const recent = entries.slice(0, 4)
  const picked = entries.find(row => row.name === focus.entry)
  const save = event => {
    event.preventDefault()
    fetch('/api/metaobjects/definitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'Custom' }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not add definition')
      setOpen(false)
      setName('')
      setError('')
      reload()
    }).catch(err => setError(err.message))
  }
  return (
    <>
      <div className="orders-top">
        <h1>Metaobjects</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => document.getElementById('definition-search')?.focus()}>Manage</button>
          <button type="button" className="solid" onClick={() => setOpen(true)}>Add definition</button>
        </div>
      </div>
      {picked && (
        <section className="handoff">
          <div>
            <h2>{picked.name}</h2>
            <p>{picked.kind} · {picked.status}</p>
          </div>
          <span className="swatch" style={{ background: picked.swatch }} />
        </section>
      )}
      <div className="meta-grid">
        <article className="detail-card">
          <span>Available on storefront</span>
          <strong>{data?.available ?? 0} entries</strong>
          <div className="swatches">{entries.slice(0, 4).map(row => <i key={row.id} className="swatch" style={{ background: row.swatch }} />)}</div>
        </article>
        <article className="detail-card">
          <span>Web pages</span>
          <strong>{data?.web_pages ?? 0} entries</strong>
        </article>
        <article className="detail-card recent-card">
          <span>Recent entries</span>
          {(all ? entries : recent).map(row => (
            <button type="button" key={row.id} className="recent-row" onClick={() => onOpen('metaobjects', { entry: row.name })}>
              <i className="swatch" style={{ background: row.swatch }} />
              <span>{row.name}</span>
              <em>{row.kind}</em>
            </button>
          ))}
          <button type="button" className="text-link" onClick={() => setAll(value => !value)}>{all ? 'Show recent' : `View all ${entries.length} entries`}</button>
        </article>
        <article className="detail-card">
          <span>Active</span>
          <strong>{data?.active ?? 0} entries</strong>
          <div className="swatches">{entries.slice(0, 4).map(row => <i key={row.id} className="swatch" style={{ background: row.swatch }} />)}</div>
        </article>
        <article className="detail-card">
          <span>Draft</span>
          <strong>{data?.draft ?? 0} entries</strong>
        </article>
      </div>
      <div className="sheet">
        <div className="toolbar">
          <select aria-label="Definition filter" defaultValue="custom"><option value="custom">Custom</option></select>
          <label className="finder"><Search size={15} /><input id="definition-search" placeholder="Searching in metaobject definitions..." value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        {definitions.length === 0 ? (
          <div className="empty-copy">
            <h2>No definitions found</h2>
            <p>Try changing the filters or search term</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Definition</th><th>Type</th></tr></thead>
            <tbody>{definitions.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.type}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/custom-data/metaobjects" target="_blank" rel="noreferrer">Learn more about metaobjects</a>
      {open && (
        <Modal title="Add definition" onClose={() => setOpen(false)}>
          <form className="modal-form" onSubmit={save}>
            <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Lookbook" autoFocus /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="solid">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
