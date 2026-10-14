import { useState } from 'react'
import { useJson } from '../lib/api.js'
import { EmptyCatalog, FormModal, PoMark } from './ui.jsx'

export function PurchaseOrders({ onOpen, focus = {} }) {
  const [rows, reload] = useJson('/api/purchase-orders')
  const [open, setOpen] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [error, setError] = useState('')
  const picked = (rows || []).find(r => String(r.id) === String(focus.po))
  const save = e => {
    e.preventDefault()
    if (!supplier.trim()) { setError('Enter a supplier.'); return }
    fetch('/api/purchase-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier: supplier.trim() }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      const created = await r.json()
      setOpen(false); setSupplier(''); setError('')
      reload()
      onOpen('purchase-orders', { po: created.id })
    }).catch(err => setError(err.message))
  }
  if (!rows) return <p className="muted">Loading purchase orders…</p>
  if (rows.length === 0 && !open) {
    return (
      <>
        <EmptyCatalog
          title="Purchase orders"
          heading="Manage your purchase orders"
          text="Track and receive inventory ordered from suppliers."
          learn="Learn more about purchase orders"
          href="https://help.shopify.com/en/manual/products/inventory/purchase-orders"
          onAction={() => setOpen(true)}
          mark={<PoMark />}
        />
        {false}
      </>
    )
  }
  return (
    <>
      <div className="orders-top">
        <h1>Purchase orders</h1>
        <button type="button" className="solid" onClick={() => setOpen(true)}>Create purchase order</button>
      </div>
      {picked && (
        <section className="handoff">
          <div>
            <h2>PO #{picked.id}</h2>
            <p>{picked.supplier} · {picked.status} · {picked.created_at.slice(0, 10)}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('purchase-orders')}>All purchase orders</button>
        </section>
      )}
      <div className="sheet">
        <table>
          <thead><tr><th>Purchase order</th><th>Supplier</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="clickable" onClick={() => onOpen('purchase-orders', { po: r.id })}>
                <td><button type="button" className="text-link">#{r.id}</button></td>
                <td>{r.supplier}</td>
                <td>{r.status}</td>
                <td>{r.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <FormModal title="Create purchase order" onClose={() => setOpen(false)}>{
          { onSubmit: save, error, fields: <label>Supplier<input autoFocus value={supplier} onChange={e => setSupplier(e.target.value)} /></label> }
        }</FormModal>
      )}
    </>
  )
}
