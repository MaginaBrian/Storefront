import { useEffect, useMemo, useState } from 'react'
import { Image, Plus } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { Toolbar } from './ui.jsx'

const EXAMPLES = [
  { id: 'men', title: "Men's clothes", group: 'intent', rule: 'Audience is Men', blurb: 'Clothes for men, women, or children.' },
  { id: 'women', title: "Women's clothes", group: 'intent', rule: 'Audience is Women', blurb: 'Clothes for men, women, or children.' },
  { id: 'children', title: "Children's clothes", group: 'intent', rule: 'Audience is Children', blurb: 'Clothes for men, women, or children.' },
  { id: 'type', title: 'Shirts', group: 'category', rule: 'Category is Shirts', blurb: 'Items of a certain type, such as lamps, cushions, or rugs.' },
  { id: 'sale', title: 'On sale', group: 'theme', rule: 'On sale', blurb: 'Items that are on sale.' },
  { id: 'color', title: 'Black', group: 'theme', rule: 'Color is Black', blurb: 'Items in a certain size or color.' },
  { id: 'season', title: 'Holiday', group: 'theme', rule: 'Season is Holiday', blurb: 'Seasonal products, such as holiday cards and decorations.' },
  { id: 'variant', title: 'Red', group: 'theme', rule: 'Variant color is Red', blurb: "Variant collections, such as only red products for Valentine's Day." },
]

function matchesRule(rule, product, variants) {
  if (rule.startsWith('Category is ')) return product.category === rule.slice('Category is '.length)
  if (rule.startsWith('Color is ')) {
    const color = rule.slice(9).toLowerCase()
    return (product.color || '').toLowerCase() === color || variants.some(item => item.product === product.title && item.variant.toLowerCase() === color)
  }
  if (rule.startsWith('Variant color is ')) {
    const color = rule.slice(17).toLowerCase()
    return variants.some(item => item.product === product.title && item.variant.toLowerCase() === color)
  }
  return false
}

function CreateCollection({ onOpen, exampleId }) {
  const [products] = useJson('/api/products')
  const [inventory] = useJson('/api/inventory')
  const starter = EXAMPLES.find(item => item.id === exampleId) || null
  const [title, setTitle] = useState(starter?.title || '')
  const [group, setGroup] = useState(starter?.group || 'category')
  const [rule, setRule] = useState(starter?.rule || 'Category is Shirts')
  const [picked, setPicked] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const catalog = products || []
  const variants = inventory || []
  const categories = [...new Set(catalog.map(product => product.category).filter(Boolean))]
  const colors = [...new Set([
    ...catalog.map(product => product.color).filter(Boolean),
    ...variants.map(item => item.variant).filter(Boolean),
  ])]
  const suggested = useMemo(
    () => catalog.filter(product => matchesRule(rule, product, variants)).map(product => product.title),
    [catalog, variants, rule],
  )
  const chosen = picked || suggested

  const setGroupRule = next => {
    setGroup(next)
    setPicked(null)
    if (next === 'category') setRule(`Category is ${categories[0] || 'Shirts'}`)
    if (next === 'theme') setRule(colors[0] ? `Color is ${colors[0]}` : 'On sale')
    if (next === 'intent') setRule('Audience is Men')
  }
  const toggle = name => {
    const current = new Set(chosen)
    current.has(name) ? current.delete(name) : current.add(name)
    setPicked([...current])
  }
  const save = event => {
    event.preventDefault()
    if (!title.trim()) { setError('Enter a collection name.'); return }
    setBusy(true)
    fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), conditions: rule, products: chosen }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not save')
      onOpen('collections', { collection: body.id })
    }).catch(err => { setError(err.message); setBusy(false) })
  }

  return (
    <form className="order-page" onSubmit={save}>
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('collections')}>Collections</button>
        <span>/</span><span>Create collection</span>
      </div>
      <div className="product-head">
        <h1>Create collection</h1>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <p className="collection-lead">Group products by category, theme, or customer intent so they are easier to find.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid">
        <div>
          <section className="detail-card">
            <label className="field">Title<input value={title} onChange={e => setTitle(e.target.value)} /></label>
            <label className="field">Group by
              <select value={group} onChange={e => setGroupRule(e.target.value)}>
                <option value="category">Category</option>
                <option value="theme">Theme</option>
                <option value="intent">Customer intent</option>
              </select>
            </label>
            {group === 'category' && (
              <label className="field">Type
                <select value={rule.startsWith('Category is ') ? rule.slice('Category is '.length) : ''} onChange={e => { setRule(`Category is ${e.target.value}`); setPicked(null) }}>
                  {categories.map(name => <option key={name}>{name}</option>)}
                </select>
              </label>
            )}
            {group === 'theme' && (
              <label className="field">Theme
                <select value={rule} onChange={e => { setRule(e.target.value); setPicked(null) }}>
                  <option value="On sale">On sale</option>
                  <option value="Season is Holiday">Seasonal — holiday</option>
                  {colors.map(color => <option key={color} value={`Color is ${color}`}>Color — {color}</option>)}
                  {colors.map(color => <option key={`variant-${color}`} value={`Variant color is ${color}`}>Variant color — {color}</option>)}
                </select>
              </label>
            )}
            {group === 'intent' && (
              <label className="field">Audience
                <select value={rule} onChange={e => { setRule(e.target.value); setPicked(null) }}>
                  <option>Audience is Men</option>
                  <option>Audience is Women</option>
                  <option>Audience is Children</option>
                </select>
              </label>
            )}
          </section>
          <section className="detail-card">
            <h2>Products</h2>
            <p className="muted">{rule}. Checked products are included when you save.</p>
            {catalog.map(product => (
              <label key={product.id} className="choice">
                <input type="checkbox" checked={chosen.includes(product.title)} onChange={() => toggle(product.title)} />
                {product.title}
                <span className="muted">{product.category}{product.color ? ` · ${product.color}` : ''}</span>
              </label>
            ))}
          </section>
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <h2>Examples</h2>
            <p className="muted">Start from a collection you might create. Nothing is saved until you click Save.</p>
            {EXAMPLES.map(item => (
              <button type="button" key={item.id} className={`text-link block-link ${item.id === exampleId || item.rule === rule ? 'on' : ''}`} onClick={() => { setTitle(item.title); setGroup(item.group); setRule(item.rule); setPicked(null) }}>
                {item.title}<small>{item.blurb}</small>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </form>
  )
}

export function Collections({ focus = {}, onOpen }) {
  const [rows, , error] = useJson('/api/collections')
  const [detail, setDetail] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!focus.collection) { setDetail(null); return }
    let ignore = false
    fetch(`/api/collections/${focus.collection}`).then(r => r.json()).then(d => { if (!ignore) setDetail(d) })
    return () => { ignore = true }
  }, [focus.collection])

  const shown = (rows || []).filter(r => r.title.toLowerCase().includes(query.trim().toLowerCase()))

  if (focus.create === '1') return <CreateCollection key={focus.example || 'new'} onOpen={onOpen} exampleId={focus.example || ''} />

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
        <button type="button" className="solid" onClick={() => onOpen('collections', { create: '1' })}><Plus size={15} /> Add collection</button>
      </div>
      <section className="panel">
        <h2>Group products into collections</h2>
        <p>Make products easier to discover by category, theme, or customer intent. These are starting points — a collection is saved only when you create it.</p>
        <div className="example-grid">
          {EXAMPLES.map(item => (
            <button type="button" key={item.id} className="example-card" onClick={() => onOpen('collections', { create: '1', example: item.id })}>
              <strong>{item.title}</strong>
              <span>{item.blurb}</span>
            </button>
          ))}
        </div>
      </section>
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
    </>
  )
}
