import { useState } from 'react'
import { useJson } from '../lib/api.js'
import { EmptyCatalog, FormModal, TransferMark } from './ui.jsx'

export function Transfers({ onOpen, focus = {} }) {
  const [rows, reload] = useJson('/api/transfers')
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState('Nairobi')
  const [destination, setDestination] = useState('Kisumu')
  const [error, setError] = useState('')
  const picked = (rows || []).find(r => String(r.id) === String(focus.transfer))
  const save = e => {
    e.preventDefault()
    if (!origin.trim() || !destination.trim()) { setError('Enter both locations.'); return }
    fetch('/api/transfers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: origin.trim(), destination: destination.trim() }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      const created = await r.json()
      setOpen(false); setError('')
      reload()
      onOpen('transfers', { transfer: created.id })
    }).catch(err => setError(err.message))
  }
  if (!rows) return <p className="muted">Loading transfers…</p>
  if (rows.length === 0 && !open) {
    return (
      <EmptyCatalog
        title="Transfers"
        heading="Move inventory between locations"
        text="Move and track inventory between your business locations."
        learn="Learn more about transfers"
        href="https://help.shopify.com/en/manual/products/inventory/transfers"
        onAction={() => setOpen(true)}
        mark={<TransferMark />}
      />
    )
  }
  return (
    <>
      <div className="orders-top">
        <h1>Transfers</h1>
        <button type="button" className="solid" onClick={() => setOpen(true)}>Create transfer</button>
      </div>
      {picked && (
        <section className="handoff">
          <div>
            <h2>Transfer #{picked.id}</h2>
            <p>{picked.origin} → {picked.destination} · {picked.status}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('inventory')}>View inventory</button>
        </section>
      )}
      <div className="sheet">
        <table>
          <thead><tr><th>Transfer</th><th>From</th><th>To</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="clickable" onClick={() => onOpen('transfers', { transfer: r.id })}>
                <td><button type="button" className="text-link">#{r.id}</button></td>
                <td>{r.origin}</td>
                <td>{r.destination}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <FormModal title="Create transfer" onClose={() => setOpen(false)}>{
          {
            onSubmit: save,
            error,
            fields: <>
              <label>From<input value={origin} onChange={e => setOrigin(e.target.value)} /></label>
              <label>To<input value={destination} onChange={e => setDestination(e.target.value)} /></label>
            </>,
          }
        }</FormModal>
      )}
    </>
  )
}
