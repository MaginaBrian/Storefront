import { useMemo, useState } from 'react'
import { Image } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { csv } from '../lib/csv.js'
import { FormModal, Toolbar } from './ui.jsx'

export function Inventory({ focus = {}, onOpen }) {
  const [rows, reload, error] = useJson('/api/inventory')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState('')
  const [variant, setVariant] = useState('')
  const [onHand, setOnHand] = useState('')
  const [formError, setFormError] = useState('')
  const shown = useMemo(() => (rows || []).filter(r => {
    if (focus.product && r.product !== focus.product) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${r.product} ${r.variant}`.toLowerCase().includes(q)
  }), [rows, query, focus.product])
  const picked = (rows || []).find(r => String(r.id) === String(focus.item))
  const save = e => {
    e.preventDefault()
    const qty = Number(onHand)
    if (!product.trim() || !Number.isFinite(qty) || qty < 0) { setFormError('Enter a product and an on-hand quantity.'); return }
    fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: product.trim(), variant: variant.trim(), on_hand: qty }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      const created = await r.json()
      setOpen(false); setProduct(''); setVariant(''); setOnHand(''); setFormError('')
      reload()
      onOpen('inventory', { item: created.id })
    }).catch(err => setFormError(err.message))
  }
  const exportRows = () => csv([
    ['Product', 'Variant', 'SKU', 'Unavailable', 'Committed', 'Available', 'On hand', 'Incoming'],
    ...(rows || []).map(r => [r.product, r.variant, r.sku || 'No SKU', r.unavailable, r.committed, r.available, r.on_hand, r.incoming]),
  ], 'inventory.csv')

  return (
    <>
      <div className="orders-top">
        <h1>Inventory</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={exportRows}>Export</button>
          <button type="button" className="ghost" onClick={() => setOpen(true)}>Import</button>
        </div>
      </div>
      {picked && (
        <section className="handoff">
          <div>
            <h2>{picked.product}</h2>
            <p>{picked.variant} · {picked.sku || 'No SKU'} · {picked.available} available · {picked.on_hand} on hand · {picked.incoming} incoming</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('inventory', { product: picked.product })}>All variants</button>
        </section>
      )}
      {focus.product && !picked && (
        <section className="handoff">
          <div><h2>{focus.product}</h2><p>{shown.length} variants</p></div>
          <button type="button" className="ghost" onClick={() => onOpen('inventory')}>All inventory</button>
        </section>
      )}
      <div className="sheet">
        <Toolbar label="Filter inventory" value={query} onChange={setQuery} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input type="checkbox" aria-label="Select all inventory" /></th>
                <th>Product</th><th>SKU</th><th>Unavailable</th><th>Committed</th><th>Available</th><th>On hand</th><th>Incoming</th>
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={8} className="muted">{error}</td></tr>}
              {shown.map(r => (
                <tr key={r.id} className={`clickable ${String(r.id) === String(focus.item) ? 'picked' : ''}`} onClick={() => onOpen('inventory', { item: r.id })}>
                  <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.product} ${r.variant}`} /></td>
                  <td>
                    <button type="button" className="text-link title-cell" onClick={e => { e.stopPropagation(); onOpen('inventory', { product: r.product }) }}><Image size={16} /> {r.product}</button>
                    <span className="variant">{r.variant}</span>
                  </td>
                  <td><span className="sku">{r.sku || 'No SKU'}</span></td>
                  <td>{r.unavailable}</td>
                  <td>{r.committed}</td>
                  <td>{r.available}</td>
                  <td>{r.on_hand}</td>
                  <td>{r.incoming}</td>
                </tr>
              ))}
              {rows && shown.length === 0 && <tr><td colSpan={8} className="muted">No inventory matches this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <FormModal title="Import inventory" onClose={() => setOpen(false)}>{
          {
            onSubmit: save,
            error: formError,
            fields: <>
              <label>Product<input autoFocus value={product} onChange={e => setProduct(e.target.value)} /></label>
              <label>Variant<input value={variant} onChange={e => setVariant(e.target.value)} placeholder="Teal" /></label>
              <label>On hand<input inputMode="numeric" value={onHand} onChange={e => setOnHand(e.target.value)} /></label>
            </>,
          }
        }</FormModal>
      )}
    </>
  )
}
