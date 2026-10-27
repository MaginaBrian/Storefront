import { useEffect, useState } from 'react'
import { useJson } from '../lib/api.js'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'
import { AddProducts, CreatePurchaseOrder } from './CreateForms.jsx'
import { EmptyCatalog, PoMark } from './ui.jsx'

const STORE = {
  name: 'Maison',
  email: 'hello@maison.co.ke',
  address: ['Nairobi', 'Nairobi', '00100', 'Kenya'],
}

function longDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function linesOf(order) {
  try {
    const parsed = JSON.parse(order.lines || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function PurchaseOrderDetail({ id, onOpen, onChanged }) {
  const [inventory] = useJson('/api/inventory')
  const [order, setOrder] = useState(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setOrder(null)
    setMissing(false)
    fetch(`/api/purchase-orders/${id}`).then(async response => {
      const body = await response.json()
      if (ignore) return
      if (!response.ok) { setMissing(true); return }
      setOrder(body)
    }).catch(() => { if (!ignore) setMissing(true) })
    return () => { ignore = true }
  }, [id])

  if (missing) {
    return (
      <section className="panel">
        <h2>Purchase order</h2>
        <p>This purchase order is not saved.</p>
        <button type="button" className="ghost" onClick={() => onOpen('purchase-orders')}>All purchase orders</button>
      </section>
    )
  }
  if (!order) return <p className="muted">Loading purchase order…</p>

  const lines = linesOf(order)
  const units = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
  const total = lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0)
  const ordered = order.status === 'ordered'
  const skuFor = line => {
    if (line.sku) return line.sku
    const item = (inventory || []).find(row => row.id === line.inventory_id)
    return item?.sku || ''
  }
  const addInventory = items => {
    const incoming = (Array.isArray(items) ? items : [items]).filter(item => !lines.some(line => line.inventory_id === item.id))
    if (ordered || !incoming.length) return
    const next = [...lines, ...incoming.map(item => ({ inventory_id: item.id, title: `${item.product} · ${item.variant}`, qty: 1, price: item.price || 0, sku: item.sku || '' }))]
    setBusy(true)
    fetch(`/api/purchase-orders/${order.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lines', lines: next }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not add the product')
      setOrder(body)
      onChanged()
    }).catch(err => setError(err.message)).finally(() => setBusy(false))
  }
  const downloadCsv = () => csv([
    ['Purchase order', 'Date', 'Supplier', 'Ship to', 'Status', 'Product', 'Variant', 'SKU', 'Qty', 'Cost', 'Tax', 'Total', 'Reference', 'Notes', 'Terms', 'Currency'],
    ...lines.map(line => {
      const [product, variant = ''] = String(line.title || '').split(' · ')
      return [
        `#PO${order.id}`, longDate(order.created_at), order.supplier, order.destination || 'Nairobi',
        'Ordered', product, variant, skuFor(line), line.qty, money(line.price || 0), '0%', money((line.price || 0) * (line.qty || 0)),
        order.reference || '', order.note || '', order.terms || 'None', order.currency || 'KES',
      ]
    }),
  ], `purchase-order-${order.id}.csv`)
  const confirm = () => {
    setBusy(true)
    fetch(`/api/purchase-orders/${order.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'order' }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not confirm')
      setOrder(body)
      onChanged()
    }).catch(err => setError(err.message)).finally(() => setBusy(false))
  }

  return (
    <div className="order-page">
      <div className="create-bar no-print">
        <div className="order-title">
          <div>
            <div className="crumb">
              <button type="button" className="text-link" onClick={() => onOpen('purchase-orders')}>Purchase orders</button>
              <span className="muted">/</span>
              <span>#PO{order.id}</span>
            </div>
            <h1>#PO{order.id}</h1>
          </div>
          <span className={`tag ${ordered ? 'open' : 'quiet'}`}>{ordered ? 'Ordered' : 'Draft'}</span>
        </div>
        <div className="create-actions">
          {ordered ? (
            <>
              <button type="button" className="ghost" onClick={downloadCsv}>Download CSV</button>
              <button type="button" className="solid" onClick={() => window.print()}>Download PDF</button>
            </>
          ) : (
            <button type="button" className="solid" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Mark as ordered'}</button>
          )}
        </div>
      </div>
      {error && <p className="form-error no-print">{error}</p>}
      {!ordered && <p className="muted no-print">Search inventory to add a product. Mark the purchase order as ordered to download the PDF or CSV.</p>}
      {!ordered && (
        <section className="detail-card no-print">
          <h2>Add from inventory</h2>
          <AddProducts inventory={inventory} lines={lines} destination={order.destination} onAdd={addInventory} hideLines />
        </section>
      )}
      <article className="po-sheet">
        <header className="po-brand">
          <strong>{STORE.name}</strong>
          <div>
            <b>#PO{order.id}</b>
            <span>{longDate(order.created_at)}</span>
          </div>
        </header>
        <h1>{STORE.name}</h1>
        <div className="po-parties">
          <section>
            <h2>Supplier</h2>
            <p>{order.supplier}</p>
          </section>
          <section>
            <h2>Ship to</h2>
            {(order.destination ? [order.destination, ...STORE.address.slice(1)] : STORE.address).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </section>
          <section>
            <h2>Bill to</h2>
            {STORE.address.map(line => <p key={line}>{line}</p>)}
          </section>
        </div>
        <div className="po-parties">
          <section><h2>Payment terms</h2><p>{order.terms || 'None'}</p></section>
          <section><h2>Supplier currency</h2><p>{order.currency || 'KES'}</p></section>
          <section><h2>Estimated arrival</h2><p>—</p></section>
        </div>
        <table>
          <thead>
            <tr><th>Products</th><th>Supplier SKU</th><th>Qty</th><th>Cost</th><th>Tax</th><th>Total (KES)</th></tr>
          </thead>
          <tbody>
            {lines.map(line => {
              const [product, variant = ''] = String(line.title || '').split(' · ')
              return (
                <tr key={`${line.inventory_id}-${line.title}`}>
                  <td>{product}{variant && <span>{variant}</span>}</td>
                  <td>{skuFor(line)}</td>
                  <td>{line.qty}</td>
                  <td>{money(line.price || 0)}</td>
                  <td>0%</td>
                  <td>{money((line.price || 0) * (line.qty || 0))}</td>
                </tr>
              )
            })}
            {lines.length === 0 && <tr><td colSpan={6} className="muted">No products on this purchase order.</td></tr>}
          </tbody>
        </table>
        <div className="po-summary">
          <div>
            <h2>Reference number</h2>
            <p>{order.reference || ''}</p>
            <h2>Notes to supplier</h2>
            <p>{order.note || ''}</p>
          </div>
          <div>
            <h2>Cost summary</h2>
            <p><span>Taxes (included)</span><b>KES 0.00</b></p>
            <p><span>Subtotal ({units} {units === 1 ? 'item' : 'items'})</span><b>{money(total)}</b></p>
            <p className="po-total"><span>Total</span><b>{money(total)}</b></p>
          </div>
        </div>
        <footer>
          <div>
            <strong>{STORE.name}</strong>
            <span>Nairobi</span>
            <span>{STORE.email}</span>
          </div>
          <span>1 of 1</span>
        </footer>
      </article>
    </div>
  )
}

export function PurchaseOrders({ onOpen, focus = {} }) {
  const [rows, reload] = useJson('/api/purchase-orders')
  if (focus.create === '1') return <CreatePurchaseOrder onOpen={onOpen} onSaved={reload} />
  if (focus.po) return <PurchaseOrderDetail id={focus.po} onOpen={onOpen} onChanged={reload} />
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
      <div className="sheet">
        <table>
          <thead><tr><th>Purchase order</th><th>Supplier</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="clickable" onClick={() => onOpen('purchase-orders', { po: r.id })}>
                <td><button type="button" className="text-link">#PO{r.id}</button></td>
                <td>{r.supplier}</td>
                <td>{r.status === 'ordered' ? 'Ordered' : 'Draft'}</td>
                <td>{r.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
