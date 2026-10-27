import { useJson } from '../lib/api.js'
import { CreateTransfer } from './CreateForms.jsx'
import { EmptyCatalog, TransferMark } from './ui.jsx'

export function Transfers({ onOpen, focus = {} }) {
  const [rows, reload] = useJson('/api/transfers')
  const picked = (rows || []).find(r => String(r.id) === String(focus.transfer))
  if (focus.create === '1') return <CreateTransfer onOpen={onOpen} onSaved={reload} purchaseOrderId={focus.po || ''} />
  if (!rows) return <p className="muted">Loading transfers…</p>
  if (rows.length === 0) {
    return (
      <EmptyCatalog
        title="Transfers"
        heading="Move inventory between locations"
        text="Move and track inventory between your business locations."
        learn="Learn more about transfers"
        href="https://help.shopify.com/en/manual/products/inventory/transfers"
        onAction={() => onOpen('transfers', { create: '1' })}
        mark={<TransferMark />}
      />
    )
  }
  return (
    <>
      <div className="orders-top">
        <h1>Transfers</h1>
        <button type="button" className="solid" onClick={() => onOpen('transfers', { create: '1' })}>Create transfer</button>
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
    </>
  )
}
