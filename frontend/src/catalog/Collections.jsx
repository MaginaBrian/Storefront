import { useEffect, useState } from 'react'
import { Image, Plus } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { FormModal, Toolbar } from './ui.jsx'

export function Collections({ focus = {}, onOpen }) {
  const [rows, reload, error] = useJson('/api/collections')
  const [detail, setDetail] = useState(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [product, setProduct] = useState('')
  const [formError, setFormError] = useState('')
  const [catalog] = useJson('/api/products')

  useEffect(() => {
    if (!focus.collection) { setDetail(null); return }
    let ignore = false
    fetch(`/api/collections/${focus.collection}`).then(r => r.json()).then(d => { if (!ignore) setDetail(d) })
    return () => { ignore = true }
  }, [focus.collection])

  const shown = (rows || []).filter(r => r.title.toLowerCase().includes(query.trim().toLowerCase()))
  const save = e => {
    e.preventDefault()
    if (!title.trim()) { setFormError('Enter a collection name.'); return }
    fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), product }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      setOpen(false); setTitle(''); setProduct(''); setFormError('')
      reload()
    }).catch(err => setFormError(err.message))
  }

  if (detail?.collection) {
    const collection = detail.collection
    return (
      <div className="order-page">
        <div className="crumb">
          <button type="button" className="text-link" onClick={() => onOpen('collections')}>Collections</button>
          <span>/</span><span>{collection.title}</span>
        </div>
        <div className="order-head"><h1 className="title" style={{ margin: 0 }}>{collection.title}</h1></div>
        <div className="order-grid">
          <section className="detail-card">
            <h2>Products</h2>
            {detail.products.length === 0 && <p className="muted">No products in this collection.</p>}
            {detail.products.map(p => (
              <button type="button" key={p.product} className="text-link" onClick={() => onOpen('products', { product: p.product })}>{p.product}</button>
            ))}
          </section>
          <aside className="order-side">
            <section className="detail-card">
              <h2>Sales channels</h2>
              {detail.channels.length === 0 && <p className="muted">Not published.</p>}
              {detail.channels.map(c => (
                <button type="button" key={c.channel} className="text-link" onClick={() => onOpen('orders', { channel: c.channel })}>{c.channel}</button>
              ))}
            </section>
            <section className="detail-card">
              <h2>Conditions</h2>
              <p className="muted">{collection.conditions || 'No conditions. Products are added by hand.'}</p>
            </section>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="orders-top">
        <h1>Collections</h1>
        <button type="button" className="solid" onClick={() => setOpen(true)}><Plus size={15} /> Add collection</button>
      </div>
      <div className="sheet">
        <Toolbar label="Filter collections" value={query} onChange={setQuery} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input type="checkbox" aria-label="Select all collections" /></th>
                <th>Title</th><th>Products</th><th>Conditions</th><th>Sales channels</th>
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={5} className="muted">{error}</td></tr>}
              {shown.map(r => (
                <tr key={r.id} className="clickable" onClick={() => onOpen('collections', { collection: r.id })}>
                  <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.title}`} /></td>
                  <td><button type="button" className="text-link title-cell" onClick={() => onOpen('collections', { collection: r.id })}><Image size={16} /> {r.title}</button></td>
                  <td>{r.products}</td>
                  <td className="muted">{r.conditions || ''}</td>
                  <td>{r.channels}</td>
                </tr>
              ))}
              {rows && shown.length === 0 && <tr><td colSpan={5} className="muted">No collections match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/products/collections" target="_blank" rel="noreferrer">Learn more about collections</a>
      {open && (
        <FormModal title="Add collection" onClose={() => setOpen(false)}>{
          {
            onSubmit: save,
            error: formError,
            fields: <>
              <label>Title<input autoFocus value={title} onChange={e => setTitle(e.target.value)} /></label>
              <label>Product
                <select value={product} onChange={e => setProduct(e.target.value)}>
                  <option value="">None yet</option>
                  {(catalog || []).map(p => <option key={p.id}>{p.title}</option>)}
                </select>
              </label>
            </>,
          }
        }</FormModal>
      )}
    </>
  )
}
