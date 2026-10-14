import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '../lib/api.js'
import { money } from '../lib/money.js'
import { Sheet } from './ui.jsx'

export function Products({ focus = {}, onOpen }) {
  const [rows, reload] = useApi('/api/products')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (focus.add !== '1') return
    setOpen(true)
    if (focus.gift === '1') setTitle('Gift card')
  }, [focus.add, focus.gift, focus.tick])
  const low = focus.stock === 'low'
  const visible = rows?.filter(r => !low || r.stock <= 14)
  const picked = rows?.find(r => r.title === focus.product)

  const save = e => {
    e.preventDefault()
    const cents = Math.round(Number(price) * 100)
    if (!title.trim() || !Number.isFinite(cents) || cents < 0) { setError('Enter a name and a valid price.'); return }
    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), price: cents, stock: Number(stock) || 0 }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      setOpen(false)
      setTitle(''); setPrice(''); setStock(''); setError('')
      reload()
    }).catch(err => setError(err.message))
  }

  return (
    <>
      {picked && (
        <section className="handoff">
          <div>
            <h2>{picked.title}</h2>
            <p>{money(picked.price)} · {picked.stock} in stock · {picked.sold} sold · {money(picked.price * picked.sold)} in sales</p>
          </div>
          {low && <button type="button" className="ghost" onClick={() => onOpen('products')}>Show all products</button>}
        </section>
      )}
      {low && !picked && (
        <section className="handoff">
          <div><h2>Low stock</h2><p>Products with 14 or fewer left.</p></div>
          <button type="button" className="ghost" onClick={() => onOpen('products')}>Show all products</button>
        </section>
      )}
      <Sheet
        title="Products"
        rows={visible}
        picked={r => r.title === focus.product}
        empty={low ? 'Nothing is low on stock.' : 'No products yet.'}
        action={<button type="button" className="cta" onClick={() => setOpen(true)}><Plus size={15} /> Add product</button>}
        columns={[
          { key: 'title', label: 'Product', render: r => <button type="button" className={`text-link ${r.title === focus.product ? 'on' : ''}`} onClick={() => onOpen('products', { product: r.title })}>{r.title}</button> },
          { key: 'price', label: 'Price', render: r => money(r.price) },
          { key: 'stock', label: 'In stock' },
          { key: 'sold', label: 'Sold' },
        ]}
      />
      {open && (
        <div className="backdrop" onClick={() => { setOpen(false); if (focus.add === '1') onOpen('products') }}>
          <form className="modal-form card pop" onClick={e => e.stopPropagation()} onSubmit={save}>
            <h2>Add product</h2>
            <label>Name<input autoFocus value={title} onChange={e => setTitle(e.target.value)} /></label>
            <label>Price (KES)<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label>
            <label>In stock<input inputMode="numeric" value={stock} onChange={e => setStock(e.target.value)} /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => { setOpen(false); if (focus.add === '1') onOpen('products') }}>Cancel</button>
              <button type="submit" className="solid">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
