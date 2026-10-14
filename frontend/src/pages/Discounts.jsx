import { useState } from 'react'
import { Modal } from '../components/Modal.jsx'
import { csv } from '../lib/csv.js'
import { useJson } from '../lib/api.js'
import { EmptyPane, Status } from './ui.jsx'

function Scissors() {
  return (
    <svg className="empty-mark" viewBox="0 0 120 100" aria-hidden="true">
      <circle cx="60" cy="50" r="36" fill="#e7f6f4" />
      <rect x="38" y="28" width="36" height="28" rx="4" fill="#e6b15a" />
      <text x="56" y="48" textAnchor="middle" fontSize="16" fill="#fff">%</text>
      <path d="M46 62c8 10 20 10 28 0" stroke="#1f8a8a" strokeWidth="4" fill="none" />
      <circle cx="44" cy="74" r="8" fill="#1f8a8a" />
      <circle cx="76" cy="74" r="8" fill="#1f8a8a" />
    </svg>
  )
}

export function Discounts() {
  const [rows, reload] = useJson('/api/discounts')
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [kind, setKind] = useState('Percentage')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const save = event => {
    event.preventDefault()
    fetch('/api/discounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, kind, value }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not create discount')
      setOpen(false)
      setCode('')
      setValue('')
      setError('')
      reload()
    }).catch(err => setError(err.message))
  }
  const actions = (
    <>
      <button type="button" className="ghost" onClick={() => csv([['Code', 'Type', 'Value', 'Status', 'Uses'], ...(rows || []).map(row => [row.code, row.kind, row.value, row.status, row.uses])], 'discounts.csv')}>Export</button>
      <button type="button" className="solid" onClick={() => setOpen(true)}>Create discount</button>
    </>
  )
  if (!rows) return <p className="muted">Loading discounts…</p>
  return (
    <>
      {rows.length === 0 ? (
        <EmptyPane
          title="Discounts"
          actions={actions}
          heading="Manage discounts and promotions"
          text="Add discount codes and automatic discounts that apply at checkout. You can also use discounts with compare at prices."
          action="Create discount"
          onAction={() => setOpen(true)}
          learn="Learn more about discounts"
          href="https://help.shopify.com/en/manual/discounts"
          mark={<Scissors />}
        />
      ) : (
        <>
          <div className="orders-top">
            <h1>Discounts</h1>
            <div className="orders-actions">{actions}</div>
          </div>
          <div className="sheet">
            <table>
              <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Uses</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.kind}</td>
                    <td>{row.value}</td>
                    <td><Status value={row.status} /></td>
                    <td>{row.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a className="learn" href="https://help.shopify.com/en/manual/discounts" target="_blank" rel="noreferrer">Learn more about discounts</a>
        </>
      )}
      {open && (
        <Modal title="Create discount" onClose={() => setOpen(false)}>
          <form className="modal-form" onSubmit={save}>
            <label>Code<input value={code} onChange={e => setCode(e.target.value)} placeholder="WELCOME10" /></label>
            <label>Type
              <select value={kind} onChange={e => setKind(e.target.value)}>
                <option>Percentage</option>
                <option>Fixed amount</option>
                <option>Free shipping</option>
              </select>
            </label>
            <label>Value<input value={value} onChange={e => setValue(e.target.value)} placeholder="10%" /></label>
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
