import { useEffect, useRef, useState } from 'react'
import {
  Bold, ChevronDown, Copy, Eye, Image, Italic, Link2, List, Mail, Plus, Share2, Smile, Trash2, Underline, X,
} from 'lucide-react'
import { money } from '../lib/money.js'

const VEST_FIELDS = ['Size', 'Battery size', 'Fabric', 'Activewear clothing features', 'Activity', 'Age group', 'Battery type', 'Insulation fill material', 'Neckline', 'Packability', 'Size type', 'Target gender']
const OTHER_FIELDS = ['Size', 'Fabric', 'Material', 'Neckline']
const COLORS = ['Off White', 'Black']

export default function ProductDetail({ productId, onOpen }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [menu, setMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(false)
  const [tag, setTag] = useState('')
  const [tagging, setTagging] = useState(false)
  const [picking, setPicking] = useState(false)
  const [library, setLibrary] = useState(null)
  const [collections, setCollections] = useState([])
  const [definition, setDefinition] = useState('')
  const [defining, setDefining] = useState(false)
  const menuRef = useRef(null)
  const descRef = useRef(null)

  useEffect(() => {
    let ignore = false
    setData(null)
    setError('')
    fetch(`/api/products/${productId}`).then(async r => {
      if (!r.ok) throw new Error('missing')
      return r.json()
    }).then(d => { if (!ignore) setData(d) }).catch(() => { if (!ignore) setError('This product is not in the store.') })
    return () => { ignore = true }
  }, [productId])

  useEffect(() => {
    if (!menu) return
    const close = e => { if (!menuRef.current?.contains(e.target)) { setMenu(false); setConfirmDelete(false) } }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const act = (action, extra = {}) => fetch(`/api/products/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  }).then(async r => {
    const body = await r.json()
    if (!r.ok) throw new Error(body.error || 'Could not update this product')
    if (body.deleted) { onOpen('products'); return body }
    setData(body)
    if (extra.title && extra.title !== data?.product?.title) onOpen('products', { product: body.product.title })
    return body
  })

  if (error) {
    return (
      <section className="panel">
        <h2>Product</h2>
        <p>{error}</p>
        <button type="button" className="ghost" onClick={() => onOpen('products')}>Back to products</button>
      </section>
    )
  }
  if (!data) return <p className="muted">Loading product…</p>

  const { product, tags, fields, collections: chosen, store } = data
  const statusLabel = product.status === 'archived' ? 'Archived' : product.status === 'draft' ? 'Draft' : 'Active'
  const url = `https://${store.domain}/products/${product.handle || product.id}`
  const suggestions = product.category.includes('Vest') ? VEST_FIELDS : OTHER_FIELDS
  const sales = product.sold > 0 ? `${money(product.price * product.sold)} from ${product.sold} sold` : 'No recent sales of this product'

  const wrap = (before, after = before) => {
    const el = descRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = `${product.description.slice(0, start)}${before}${product.description.slice(start, end)}${after}${product.description.slice(end)}`
    act('update', { description: next })
  }

  return (
    <div className="order-page">
      <div className="product-head">
        <div>
          <div className="crumb">
            <button type="button" className="text-link" onClick={() => onOpen('products')}>Products</button>
          </div>
          <div className="order-title">
            <h1>{product.title}</h1>
            <span className={`status-pill ${product.status}`}>{statusLabel}</span>
          </div>
        </div>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setPreview(p => !p)}><Eye size={14} /> View as</button>
          <button type="button" className="ghost" onClick={() => setPreview(true)}>Preview</button>
          <button type="button" className="ghost" onClick={() => { navigator.clipboard?.writeText(url); setNotice('Product link copied.') }}><Share2 size={14} /> Share</button>
          <div className="menu" ref={menuRef}>
            <button type="button" className="ghost" aria-expanded={menu} onClick={() => setMenu(o => !o)}>More actions <ChevronDown size={14} /></button>
            {menu && (
              <div className="popover menu-pop">
                <button type="button" onClick={() => { setMenu(false); act('duplicate').then(d => onOpen('products', { product: d.product.title })) }}><Copy size={14} /> Duplicate product</button>
                <button type="button" onClick={() => { setMenu(false); act('archive'); setNotice('Product archived.') }}><ArchiveMark /> Archive product</button>
                <button type="button" className="danger" onClick={() => {
                  if (!confirmDelete) { setConfirmDelete(true); return }
                  act('delete')
                }}><Trash2 size={14} /> {confirmDelete ? 'Confirm delete' : 'Delete product'}</button>
                <button type="button" onClick={() => onOpen('campaigns', { create: '1' })}><Mail size={14} /> Create email campaign</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {notice && <p className="notice">{notice}</p>}
      {preview && (
        <section className="detail-card preview-card">
          <p className="muted">{store.name}</p>
          <h2>{product.title}</h2>
          <p>{money(product.price)}</p>
          {product.color && <p className="muted">Color · {product.color}</p>}
          <p>{product.description || 'No description yet.'}</p>
        </section>
      )}
      <div className="order-grid">
        <div>
          <section className="detail-card">
            <label className="field">Title
              <input defaultValue={product.title} key={product.title} onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== product.title) act('update', { title: e.target.value.trim() }) }} />
            </label>
            <label className="field">Description
              <div className="editor">
                <div className="editor-bar">
                  <button type="button" aria-label="Paragraph"><TypeIcon /> Paragraph <ChevronDown size={12} /></button>
                  <button type="button" aria-label="Bold" onClick={() => wrap('**')}><Bold size={14} /></button>
                  <button type="button" aria-label="Italic" onClick={() => wrap('_')}><Italic size={14} /></button>
                  <button type="button" aria-label="Underline" onClick={() => wrap('<u>', '</u>')}><Underline size={14} /></button>
                  <button type="button" aria-label="Link" onClick={() => wrap('[', '](https://)')}><Link2 size={14} /></button>
                  <button type="button" aria-label="Image" onClick={() => wrap('![', '](image)')}><Image size={14} /></button>
                  <button type="button" aria-label="List" onClick={() => wrap('\n- ')}><List size={14} /></button>
                  <button type="button" aria-label="Emoji" onClick={() => wrap(':)')}><Smile size={14} /></button>
                </div>
                <textarea ref={descRef} key={`${product.id}-${product.description}`} defaultValue={product.description} rows={6} placeholder="Describe this product" onBlur={e => { if (e.target.value !== product.description) act('update', { description: e.target.value }) }} />
              </div>
            </label>
          </section>
          <section className="detail-card">
            <h2>Media</h2>
            <div className="media-drop">
              {product.media
                ? <p>{product.media} <button type="button" className="text-link" onClick={() => act('update', { media: '' })}>Remove</button></p>
                : <p className="muted">Accepts images, videos, or 3D models</p>}
              <div className="orders-actions">
                <label className="ghost file-btn">Upload new
                  <input type="file" accept="image/*,video/*" onChange={e => { const file = e.target.files?.[0]; if (file) act('update', { media: file.name }) }} />
                </label>
                <button type="button" className="text-link" onClick={() => {
                  setLibrary(library ? null : [])
                  if (!library) fetch('/api/products').then(r => r.json()).then(rows => setLibrary(rows.filter(r => r.media && r.id !== product.id)))
                }}>Select existing</button>
              </div>
              {library && (
                <div className="library">
                  {library.length === 0 && <p className="muted">No media in the library yet.</p>}
                  {library.map(item => (
                    <button type="button" key={item.id} onClick={() => { act('update', { media: item.media }); setLibrary(null) }}>{item.title} · {item.media}</button>
                  ))}
                </div>
              )}
            </div>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h2>Category</h2>
              {product.color && <span className="meta-count">1 metafield</span>}
            </div>
            <input className="category-input" defaultValue={product.category} key={product.category} onBlur={e => { if (e.target.value !== product.category) act('update', { category: e.target.value }) }} />
            <p className="muted">Determines tax rates and adds metafields to improve search, filters, and cross-channel sales.</p>
          </section>
          <section className="detail-card">
            <h2>Category metafields <span className="muted">{product.category || 'No category'}</span></h2>
            <div className="color-row">
              <span>Color</span>
              {COLORS.map(color => (
                <label key={color} className={product.color === color ? 'on' : ''}>
                  <input type="radio" name="color" checked={product.color === color} onChange={() => act('update', { color })} />
                  {color}
                </label>
              ))}
            </div>
            <div className="meta-add">
              {suggestions.filter(name => !fields.includes(name)).map(name => (
                <button type="button" key={name} onClick={() => act('field', { name })}><Plus size={12} /> {name}</button>
              ))}
            </div>
            {fields.filter(name => name !== 'Disclosures').map(name => (
              <p key={name} className="pinned-field">{name} <button type="button" className="icon-btn" aria-label={`Remove ${name}`} onClick={() => act('field', { name, remove: true })}><X size={12} /></button></p>
            ))}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h2>Product metafields</h2>
              <button type="button" className="text-link" onClick={() => setDefining(o => !o)}>View all</button>
              <button type="button" className="ghost" onClick={() => setDefining(true)}>Add definition</button>
            </div>
            {fields.length === 0 && <p className="muted">No metafields pinned</p>}
            {fields.includes('Disclosures') && <p className="pinned-field">Disclosures <button type="button" className="icon-btn" aria-label="Remove Disclosures" onClick={() => act('field', { name: 'Disclosures', remove: true })}><X size={12} /></button></p>}
            <button type="button" className="meta-add-one" onClick={() => act('field', { name: 'Disclosures' })}><Plus size={12} /> Disclosures</button>
            {defining && (
              <form className="tag-form" onSubmit={e => { e.preventDefault(); if (!definition.trim()) return; act('field', { name: definition.trim() }).then(() => { setDefinition(''); setDefining(false) }) }}>
                <input value={definition} onChange={e => setDefinition(e.target.value)} placeholder="Metafield name" autoFocus />
                <button type="submit" className="solid">Add</button>
              </form>
            )}
          </section>
          <section className="detail-card seo-card">
            <div className="card-title">
              <h2>Search engine listing</h2>
              <button type="button" className="icon-btn" aria-label="Edit listing" onClick={() => descRef.current?.focus()}><PencilMark /></button>
            </div>
            <p>{store.name}</p>
            <p className="muted">{url}</p>
            <p className="seo-title">{product.title}</p>
            <p>{money(product.price)}</p>
          </section>
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <h2>Status</h2>
            <select value={product.status} onChange={e => act('update', { status: e.target.value })}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </section>
          <section className="detail-card">
            <h2>Publishing</h2>
            <p>All channels</p>
            <button type="button" className="text-link" onClick={() => onOpen('orders', { channel: 'Online Store' })}>Online Store</button>
            <button type="button" className="text-link" onClick={() => onOpen('orders', { channel: 'WhatsApp' })}>WhatsApp</button>
          </section>
          <section className="detail-card">
            <h2>Sales</h2>
            <p className="muted">{sales}</p>
            <button type="button" className="text-link" onClick={() => onOpen('analytics')}>View details</button>
          </section>
          <section className="detail-card">
            <h2>Product organization</h2>
            <label className="field">Type
              <select value={product.product_type || ''} onChange={e => act('update', { product_type: e.target.value })}>
                <option value="">None</option>
                <option>Vest</option>
                <option>Shirt</option>
                <option>Bag</option>
                <option>Accessory</option>
              </select>
            </label>
            <label className="field">Vendor
              <input defaultValue={product.vendor} key={product.vendor} onBlur={e => { if (e.target.value !== product.vendor) act('update', { vendor: e.target.value }) }} />
            </label>
            <div className="field">
              <span>Collections</span>
              {chosen.map(c => (
                <button type="button" key={c.id} className="chip" onClick={() => act('collection', { collection: c.id, remove: true })}>{c.title} <X size={12} /></button>
              ))}
              <button type="button" className="text-link" onClick={() => {
                setPicking(o => !o)
                if (!collections.length) fetch('/api/collections').then(r => r.json()).then(setCollections)
              }}>Add collections</button>
              {picking && collections.filter(c => !chosen.some(item => item.id === c.id)).map(c => (
                <button type="button" key={c.id} className="text-link" onClick={() => act('collection', { collection: c.id })}>{c.title}</button>
              ))}
            </div>
            <div className="field">
              <span>Tags</span>
              <div className="tag-list">
                {tags.map(item => (
                  <button type="button" key={item} className="chip" onClick={() => act('tag', { tag: item, remove: true })}>{item} <X size={12} /></button>
                ))}
              </div>
              {tagging ? (
                <form className="tag-form" onSubmit={e => { e.preventDefault(); if (!tag.trim()) return; act('tag', { tag: tag.trim() }).then(() => { setTag(''); setTagging(false) }) }}>
                  <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Add a tag" autoFocus />
                  <button type="submit" className="solid">Add</button>
                </form>
              ) : <button type="button" className="text-link" onClick={() => setTagging(true)}>Add tags</button>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function TypeIcon() {
  return <span aria-hidden="true" className="type-mark">T</span>
}

function PencilMark() {
  return <span aria-hidden="true">✎</span>
}

function ArchiveMark() {
  return <span aria-hidden="true" className="box-mark" />
}
