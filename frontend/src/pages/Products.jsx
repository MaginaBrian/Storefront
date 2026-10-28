import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '../lib/api.js'
import { money } from '../lib/money.js'
import AddProduct from './AddProduct.jsx'
import ProductDetail from './ProductDetail.jsx'
import { Sheet } from './ui.jsx'

export function Products({ focus = {}, onOpen }) {
  const [rows, reload] = useApi('/api/products')
  useEffect(() => { if (!focus.product && focus.add !== '1') reload() }, [focus.product, focus.add])
  if (focus.add === '1') return <AddProduct onOpen={onOpen} gift={focus.gift === '1'} />
  const low = focus.stock === 'low'
  const visible = rows?.filter(r => !low || r.stock <= 14)
  const picked = rows?.find(r => r.title === focus.product)
  if (focus.product && !focus.add) {
    if (!rows) return <p className="muted">Loading product…</p>
    if (!picked) {
      return (
        <section className="panel">
          <h2>{focus.product}</h2>
          <p>This product is not in the store.</p>
          <button type="button" className="ghost" onClick={() => onOpen('products')}>Back to products</button>
        </section>
      )
    }
    return <ProductDetail productId={picked.id} onOpen={onOpen} />
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
        action={<button type="button" className="cta" onClick={() => onOpen('products', { add: '1' })}><Plus size={15} /> Add product</button>}
        columns={[
          { key: 'title', label: 'Product', render: r => <button type="button" className={`text-link ${r.title === focus.product ? 'on' : ''}`} onClick={() => onOpen('products', { product: r.title })}>{r.title}</button> },
          { key: 'price', label: 'Price', render: r => money(r.price) },
          { key: 'variants', label: 'Variants', render: r => r.variants || 0 },
          { key: 'stock', label: 'In stock' },
          { key: 'sold', label: 'Sold' },
        ]}
      />
    </>
  )
}
