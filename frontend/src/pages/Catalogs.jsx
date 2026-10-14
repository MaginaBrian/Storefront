import { useState } from 'react'
import { Modal } from '../components/Modal.jsx'
import { csv } from '../lib/csv.js'
import { useJson } from '../lib/api.js'
import { EmptyPane } from './ui.jsx'

function CatalogMark() {
  return (
    <svg className="empty-mark" viewBox="0 0 120 100" aria-hidden="true">
      <circle cx="60" cy="50" r="34" fill="#f3f6f4" />
      <rect x="38" y="28" width="44" height="36" rx="4" fill="#fff" stroke="#d5e0d8" />
      <circle cx="50" cy="42" r="6" fill="#1f8a5b" />
      <rect x="60" y="38" width="14" height="4" rx="2" fill="#c9ddd2" />
      <rect x="46" y="52" width="26" height="4" rx="2" fill="#c9ddd2" />
    </svg>
  )
}

export function Catalogs({ onOpen }) {
  const [rows, reload] = useJson('/api/market-catalogs')
  const [markets] = useJson('/api/markets')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [market, setMarket] = useState('Kenya')
  const [error, setError] = useState('')
  const save = event => {
    event.preventDefault()
    fetch('/api/market-catalogs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, market }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not create catalog')
      setOpen(false)
      setTitle('')
      setError('')
      reload()
    }).catch(err => setError(err.message))
  }
  const actions = (
    <>
      <button type="button" className="ghost" onClick={() => csv([['Catalog', 'Market'], ...(rows || []).map(row => [row.title, row.market])], 'catalogs.csv')}>Export</button>
      <button type="button" className="ghost" onClick={() => setOpen(true)}>Import</button>
      <button type="button" className="solid" onClick={() => setOpen(true)}>Create catalog</button>
    </>
  )
  if (!rows) return <p className="muted">Loading catalogs…</p>
  return (
    <>
      {rows.length === 0 ? (
        <EmptyPane
          title="Catalogs"
          actions={actions}
          heading="Personalize buying with catalogs"
          text="Create custom product and pricing offerings for your customers with catalogs."
          action="Create catalog"
          onAction={() => setOpen(true)}
          learn="Learn more about catalogs"
          href="https://help.shopify.com/en/manual/b2b/catalogs"
          mark={<CatalogMark />}
        />
      ) : (
        <>
          <div className="orders-top"><h1>Catalogs</h1><div className="orders-actions">{actions}</div></div>
          <div className="sheet">
            <table>
              <thead><tr><th>Catalog</th><th>Market</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td><button type="button" className="text-link" onClick={() => onOpen('markets', { market: row.market })}>{row.market}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {open && (
        <Modal title="Create catalog" onClose={() => setOpen(false)}>
          <form className="modal-form" onSubmit={save}>
            <label>Title<input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></label>
            <label>Market
              <select value={market} onChange={e => setMarket(e.target.value)}>
                {(markets || [{ name: 'Kenya' }]).map(row => <option key={row.name}>{row.name}</option>)}
              </select>
            </label>
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
