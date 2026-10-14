import { useJson } from '../lib/api.js'
import { CreatePurchaseOrder } from './CreateForms.jsx'
import { EmptyCatalog, PoMark } from './ui.jsx'

export function PurchaseOrders({ onOpen, focus = {} }) {
  const [rows, reload] = useJson('/api/purchase-orders')
  const picked = (rows || []).find(r => String(r.id) === String(focus.po))
  if (focus.create === '1') return <CreatePurchaseOrder onOpen={onOpen} onSaved={reload} />
  if (!rows) return <p className="muted">Loading purchase orders…</p>
  if (rows.length === 0) {
    return (
      <>
        <EmptyCatalog
          title="Purchase orders"
          heading="Manage your purchase orders"
          text="Track and receive inventory ordered from suppliers."
          learn="Learn more about purchase orders"
          href="https://help.shopify.com/en/manual/products/inventory/purchase-orders"
          onAction={() => onOpen('purchase-orders', { create: '1' })}
          mark={<PoMark />}
        />
      </>
    )
  }
  return (
    <>
      <div className="orders-top">
        <h1>Purchase orders</h1>
        <button type="button" className="solid" onClick={() => onOpen('purchase-orders', { create: '1' })}>Create purchase order</button>
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
    </>
  )
}
