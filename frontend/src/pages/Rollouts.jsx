import { useState } from 'react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'
import { EmptyPane } from './ui.jsx'

function RolloutMark() {
  return (
    <svg className="empty-mark" viewBox="0 0 140 100" aria-hidden="true">
      <circle cx="70" cy="28" r="10" fill="#e7eef8" stroke="#c5d4ea" />
      <rect x="28" y="52" width="34" height="28" rx="4" fill="#fff" stroke="#d5e0ea" />
      <rect x="78" y="52" width="34" height="28" rx="4" fill="#fff" stroke="#d5e0ea" />
      <path d="M70 38v8M45 52v-6h50v6" stroke="#c5d4ea" fill="none" />
    </svg>
  )
}

export function Rollouts() {
  const [rows, reload] = useJson('/api/rollouts')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const save = event => {
    event.preventDefault()
    fetch('/api/rollouts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, note }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not create rollout')
      setOpen(false)
      setName('')
      setNote('')
      setError('')
      reload()
    }).catch(err => setError(err.message))
  }
  const create = <button type="button" className="solid" onClick={() => setOpen(true)}>Create rollout</button>
  if (!rows) return <p className="muted">Loading rollouts…</p>
  return (
    <>
      {rows.length === 0 ? (
        <EmptyPane
          title="Rollouts"
          actions={create}
          heading="Schedule changes to your store"
          text="Prepare changes to themes, discounts, catalogs, and checkout for upcoming launches, temporary events, or A/B tests."
          action="Create rollout"
          onAction={() => setOpen(true)}
          learn="Learn more about rollouts"
          href="https://help.shopify.com/en/manual/markets/rollouts"
          mark={<RolloutMark />}
        />
      ) : (
        <>
          <div className="orders-top"><h1>Rollouts</h1>{create}</div>
          <div className="sheet">
            <table>
              <thead><tr><th>Rollout</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.note || '—'}</td><td>{row.created_at}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      {open && (
        <Modal title="Create rollout" onClose={() => setOpen(false)}>
          <form className="modal-form" onSubmit={save}>
            <label>Name<input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
            <label>Note<input value={note} onChange={e => setNote(e.target.value)} /></label>
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
