import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronLeft, Globe, Image, Plus, Search, X } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { money } from '../lib/money.js'
import { Modal } from '../components/Modal.jsx'
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

const ATTRIBUTES = ['Category', 'Compare at price', 'Inventory stock', 'Price', 'Status', 'Tag', 'Title', 'Type', 'Variant title', 'Vendor']
const TEXT_OPS = ['is', 'is not', 'contains', 'does not contain']
const NUMBER_OPS = ['is equal to', 'is greater than', 'is less than']
const STATUS_OPS = ['is', 'is not']
const SORTS = ['Best selling', 'Product title A–Z', 'Product title Z–A', 'Highest price', 'Lowest price', 'Newest', 'Oldest', 'Manually']
const CHANNELS = ['Online Store', 'Agentic']
const STARTERS = {
  men: { title: "Men's clothes", conditions: [{ attribute: 'Title', operator: 'contains', value: 'Men' }] },
  women: { title: "Women's clothes", conditions: [{ attribute: 'Title', operator: 'contains', value: 'Women' }] },
  children: { title: "Children's clothes", conditions: [{ attribute: 'Title', operator: 'contains', value: 'Children' }] },
  type: { title: 'Shirts', conditions: [{ attribute: 'Type', operator: 'is', value: 'Shirt' }] },
  sale: { title: 'On sale', conditions: [{ attribute: 'Compare at price', operator: 'is greater than', value: '0' }] },
  color: { title: 'Black', conditions: [{ attribute: 'Variant title', operator: 'is', value: 'Black' }] },
  season: { title: 'Holiday', conditions: [{ attribute: 'Tag', operator: 'is', value: 'Holiday' }] },
  variant: { title: 'Red', conditions: [{ attribute: 'Variant title', operator: 'is', value: 'Red' }] },
}

function operatorsFor(attribute) {
  if (attribute === 'Status') return STATUS_OPS
  if (['Price', 'Compare at price', 'Inventory stock'].includes(attribute)) return NUMBER_OPS
  return TEXT_OPS
}

function slug(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function factsFor(product, inventory) {
  let extra = {}
  try { extra = JSON.parse(product.extra || '{}') } catch { extra = {} }
  const variants = inventory.filter(row => row.product === product.title)
  const stock = variants.length
    ? variants.reduce((sum, row) => sum + Number(row.on_hand || 0), 0)
    : Number(product.stock || 0)
  return {
    category: product.category || '',
    compare: Number(extra.compare_at || 0) / 100,
    stock,
    price: Number(product.price || 0) / 100,
    status: product.status || 'active',
    tags: product.tags || [],
    title: product.title || '',
    type: product.product_type || '',
    variants: [...new Set([product.color, ...variants.map(row => row.variant)].filter(Boolean))],
    vendor: product.vendor || '',
  }
}

function ruleMatches(fact, rule) {
  const raw = String(rule.value || '').trim()
  if (!raw) return false
  const op = rule.operator
  if (['Price', 'Compare at price', 'Inventory stock'].includes(rule.attribute)) {
    const target = Number(raw)
    if (!Number.isFinite(target)) return false
    const value = rule.attribute === 'Price' ? fact.price : rule.attribute === 'Compare at price' ? fact.compare : fact.stock
    if (op === 'is equal to') return value === target
    if (op === 'is greater than') return value > target
    return value < target
  }
  const values = (
    rule.attribute === 'Category' ? [fact.category]
      : rule.attribute === 'Title' ? [fact.title]
        : rule.attribute === 'Type' ? [fact.type]
          : rule.attribute === 'Vendor' ? [fact.vendor]
            : rule.attribute === 'Tag' ? fact.tags
              : rule.attribute === 'Variant title' ? fact.variants
                : [fact.status]
  ).map(item => String(item).toLowerCase())
  const needle = rule.attribute === 'Status' ? raw.toLowerCase() : raw.toLowerCase()
  const statusNeedle = needle === 'active' || needle === 'draft' || needle === 'archived' ? needle : needle
  const wanted = rule.attribute === 'Status' ? statusNeedle : needle
  if (op === 'is' || op === 'is equal to') return values.some(item => item === wanted)
  if (op === 'is not') return values.every(item => item !== wanted)
  if (op === 'contains') return values.some(item => item.includes(wanted))
  return values.every(item => !item.includes(wanted))
}

function describe(rules, prefix = '') {
  return rules
    .filter(rule => String(rule.value || '').trim())
    .map(rule => `${prefix}${rule.attribute} ${rule.operator} ${rule.value.trim()}`)
    .join(' and ')
}

function AttributeMenu({ query, onQuery, onPick }) {
  const shown = ATTRIBUTES.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="category-menu">
      <label className="category-search">
        <Search size={14} />
        <input aria-label="Search attributes" placeholder="Search attributes" value={query} onChange={e => onQuery(e.target.value)} />
      </label>
      {shown.map(name => (
        <button type="button" key={name} onClick={() => onPick(name)}>{name}</button>
      ))}
      {shown.length === 0 && <p className="muted">No attributes match.</p>}
    </div>
  )
}

function RuleEditor({ rule, onChange, onRemove }) {
  const operators = operatorsFor(rule.attribute)
  return (
    <div className="rule-row">
      <select aria-label="Attribute" value={rule.attribute} onChange={e => {
        const attribute = e.target.value
        onChange({ ...rule, attribute, operator: operatorsFor(attribute)[0], value: attribute === 'Status' ? 'active' : '' })
      }}>
        {ATTRIBUTES.map(name => <option key={name}>{name}</option>)}
      </select>
      <select aria-label="Operator" value={rule.operator} onChange={e => onChange({ ...rule, operator: e.target.value })}>
        {operators.map(name => <option key={name}>{name}</option>)}
      </select>
      {rule.attribute === 'Status' ? (
        <select aria-label="Status" value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })}>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      ) : (
        <input aria-label="Condition value" value={rule.value} placeholder="Value" onChange={e => onChange({ ...rule, value: e.target.value })} />
      )}
      <button type="button" className="icon-btn" aria-label="Remove condition" onClick={onRemove}><X size={14} /></button>
    </div>
  )
}

function CreateCollection({ onOpen, exampleId }) {
  const [products] = useJson('/api/products')
  const [inventory] = useJson('/api/inventory')
  const starter = STARTERS[exampleId] || null
  const nextId = useRef(1)
  const fileRef = useRef(null)
  const [title, setTitle] = useState(starter?.title || '')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [conditions, setConditions] = useState(() => (starter?.conditions || []).map(rule => ({ ...rule, id: nextId.current++ })))
  const [excludes, setExcludes] = useState([])
  const [manual, setManual] = useState([])
  const [channels, setChannels] = useState(CHANNELS)
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [sort, setSort] = useState('Best selling')
  const [sortOpen, setSortOpen] = useState(false)
  const [attributeFor, setAttributeFor] = useState('')
  const [attributeQuery, setAttributeQuery] = useState('')
  const [picking, setPicking] = useState(false)
  const [draftPicks, setDraftPicks] = useState([])
  const [productQuery, setProductQuery] = useState('')
  const [searchBy, setSearchBy] = useState('All')
  const [theme, setTheme] = useState('Default collection')
  const [seoOpen, setSeoOpen] = useState(false)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const catalog = products || []
  const stock = inventory || []

  const included = useMemo(() => {
    const byTitle = new Map(catalog.map(product => [product.title, product]))
    const names = new Set(manual)
    if (conditions.some(rule => String(rule.value || '').trim())) {
      catalog.forEach(product => {
        const fact = factsFor(product, stock)
        if (conditions.every(rule => !String(rule.value || '').trim() || ruleMatches(fact, rule))) names.add(product.title)
      })
    }
    catalog.forEach(product => {
      const fact = factsFor(product, stock)
      if (excludes.some(rule => String(rule.value || '').trim() && ruleMatches(fact, rule))) names.delete(product.title)
    })
    let rows = [...names].map(name => byTitle.get(name)).filter(Boolean)
    if (sort === 'Product title A–Z') rows.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'Product title Z–A') rows.sort((a, b) => b.title.localeCompare(a.title))
    if (sort === 'Highest price') rows.sort((a, b) => b.price - a.price)
    if (sort === 'Lowest price') rows.sort((a, b) => a.price - b.price)
    if (sort === 'Newest') rows.sort((a, b) => b.id - a.id)
    if (sort === 'Oldest') rows.sort((a, b) => a.id - b.id)
    if (sort === 'Best selling') rows.sort((a, b) => (b.sold || 0) - (a.sold || 0))
    return rows
  }, [catalog, stock, manual, conditions, excludes, sort])

  const dirty = Boolean(
    title.trim() || description.trim() || image || conditions.length || excludes.length || manual.length
    || channels.length !== CHANNELS.length || sort !== 'Best selling' || theme !== 'Default collection'
    || seoTitle || seoDescription,
  )

  const addRule = (list, setList, attribute) => {
    setList(current => [...current, {
      id: nextId.current++,
      attribute,
      operator: operatorsFor(attribute)[0],
      value: attribute === 'Status' ? 'active' : '',
    }])
    setAttributeFor('')
    setAttributeQuery('')
  }

  const save = event => {
    event.preventDefault()
    if (!title.trim()) { setError('Enter a title.'); return }
    setBusy(true)
    fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description,
        image,
        conditions: describe(conditions),
        excludes: describe(excludes, 'Exclude '),
        products: included.map(product => product.title),
        channels,
        theme,
        seo_title: seoTitle.trim() || title.trim(),
        seo_description: seoDescription.trim() || description.trim(),
        sort,
      }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not save')
      onOpen('collections', { collection: body.id })
    }).catch(err => { setError(err.message); setBusy(false) })
  }

  const channelLabel = channels.length === 1 ? '1 channel' : `${channels.length} channels`
  const handle = slug(title)
  const listingTitle = seoTitle.trim() || title.trim() || 'Add title'
  const productHits = catalog.filter(product => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return true
    if (searchBy === 'Title') return product.title.toLowerCase().includes(q)
    if (searchBy === 'Vendor') return (product.vendor || '').toLowerCase().includes(q)
    if (searchBy === 'Category') return (product.category || '').toLowerCase().includes(q)
    return [product.title, product.vendor, product.category, product.product_type].join(' ').toLowerCase().includes(q)
  })

  return (
    <form className="order-page" onSubmit={save}>
      <div className="create-bar">
        <div className="order-title">
          <button type="button" className="icon-btn" aria-label="Back to collections" onClick={() => onOpen('collections')}><ChevronLeft size={18} /></button>
          <div className="crumb">
            <button type="button" className="text-link" onClick={() => onOpen('collections')}>Collections</button>
            <span className="muted">/</span>
            <span>Add collection</span>
          </div>
        </div>
        <div className="create-actions">
          {dirty && <span className="unsaved">Unsaved collection</span>}
          <button type="button" className="ghost" disabled={!dirty || busy} onClick={() => onOpen('collections')}>Discard</button>
          <button type="submit" className="solid" disabled={busy}>Save</button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid collection-layout">
        <div>
          <section className="detail-card collection-hero">
            <button type="button" className="collection-image" aria-label="Collection image" onClick={() => fileRef.current?.click()}>
              {image ? <img src={image} alt="" /> : <Image size={22} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => setImage(String(reader.result || ''))
              reader.readAsDataURL(file)
            }} />
            <div>
              <input className="collection-title" aria-label="Title" placeholder="Add title" value={title} autoFocus onChange={e => setTitle(e.target.value)} />
              <input className="collection-desc" aria-label="Description" placeholder="Add description" value={description} onChange={e => setDescription(e.target.value)} />
              <div className="collection-channels">
                <button type="button" className="text-link" onClick={() => setChannelsOpen(open => !open)}>
                  <Globe size={14} /> {channelLabel} <ChevronDown size={14} />
                </button>
                {channelsOpen && (
                  <div className="category-menu channel-pop">
                    {CHANNELS.map(name => (
                      <label key={name} className="choice">
                        <input type="checkbox" checked={channels.includes(name)} onChange={() => setChannels(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name])} />
                        {name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          <section className="detail-card">
            <h2>Collection items <span className="muted">{included.length}</span></h2>
            <div className="item-grid">
              {included.length === 0 && Array.from({ length: 8 }, (_, index) => (
                <div className="item-ghost" key={index}><i /><b /></div>
              ))}
              {included.map(product => (
                <button type="button" className="item-card" key={product.id} onClick={() => onOpen('products', { product: product.title })}>
                  <span className="item-photo">{product.media ? <img src={product.media} alt="" /> : <Image size={16} />}</span>
                  <strong>{product.title}</strong>
                  <span className="muted">{money(product.price)}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="detail-card">
            <h2>Theme template</h2>
            <select aria-label="Theme template" value={theme} onChange={e => setTheme(e.target.value)}>
              <option>Default collection</option>
            </select>
          </section>
          <section className="detail-card">
            <div className="side-head">
              <h2>Search engine listing</h2>
              <button type="button" className="text-link" onClick={() => setSeoOpen(open => !open)}>{seoOpen ? 'Close' : 'Edit'}</button>
            </div>
            {seoOpen ? (
              <>
                <label className="field">Page title<input value={seoTitle} placeholder={title || 'Add title'} onChange={e => setSeoTitle(e.target.value)} /></label>
                <label className="field">Meta description<input value={seoDescription} placeholder={description || 'Add description'} onChange={e => setSeoDescription(e.target.value)} /></label>
              </>
            ) : (
              <div className="seo-preview">
                <strong>{listingTitle}</strong>
                <span>piaci / collections / {handle}</span>
              </div>
            )}
          </section>
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <div className="side-head">
              <h2>Products</h2>
              <button type="button" className="text-link" aria-label="Sort products" onClick={() => { setSortOpen(open => !open); setAttributeFor('') }}>
                <ArrowUpDown size={14} />
              </button>
            </div>
            {sortOpen && (
              <div className="category-menu">
                {SORTS.map(name => (
                  <button type="button" key={name} className={sort === name ? 'on' : ''} onClick={() => { setSort(name); setSortOpen(false) }}>{name}</button>
                ))}
              </div>
            )}
            <div className="collection-tools">
              <button type="button" className="pill-btn" onClick={() => { setAttributeFor(attributeFor === 'include' ? '' : 'include'); setAttributeQuery(''); setSortOpen(false) }}>
                <Plus size={14} /> Add condition
              </button>
              <button type="button" className="pill-btn" onClick={() => { setDraftPicks(manual); setProductQuery(''); setPicking(true) }}>
                <Search size={14} /> Add products
              </button>
            </div>
            {attributeFor === 'include' && (
              <AttributeMenu query={attributeQuery} onQuery={setAttributeQuery} onPick={name => addRule(conditions, setConditions, name)} />
            )}
            {conditions.map(rule => (
              <RuleEditor key={rule.id} rule={rule} onChange={next => setConditions(current => current.map(item => item.id === rule.id ? next : item))} onRemove={() => setConditions(current => current.filter(item => item.id !== rule.id))} />
            ))}
            <button type="button" className="text-link exclude-link" onClick={() => { setAttributeFor(attributeFor === 'exclude' ? '' : 'exclude'); setAttributeQuery(''); setSortOpen(false) }}>
              <Plus size={14} /> Exclude
            </button>
            {attributeFor === 'exclude' && (
              <AttributeMenu query={attributeQuery} onQuery={setAttributeQuery} onPick={name => addRule(excludes, setExcludes, name)} />
            )}
            {excludes.map(rule => (
              <RuleEditor key={rule.id} rule={rule} onChange={next => setExcludes(current => current.map(item => item.id === rule.id ? next : item))} onRemove={() => setExcludes(current => current.filter(item => item.id !== rule.id))} />
            ))}
            <button type="button" className="dash-add" aria-label="Add another condition" onClick={() => { setAttributeFor('include'); setAttributeQuery('') }}>
              <Plus size={16} />
            </button>
          </section>
        </aside>
      </div>
      {picking && (
        <Modal title="Select products to include" onClose={() => setPicking(false)}>
          <div className="product-picker">
            <div className="picker-tools">
              <label className="category-search">
                <Search size={14} />
                <input aria-label="Search products" placeholder="Search products" value={productQuery} onChange={e => setProductQuery(e.target.value)} />
              </label>
              <select aria-label="Search by" value={searchBy} onChange={e => setSearchBy(e.target.value)}>
                <option value="All">Search by All</option>
                <option value="Title">Title</option>
                <option value="Vendor">Vendor</option>
                <option value="Category">Category</option>
              </select>
            </div>
            <div className="picker-list">
              {productHits.map(product => (
                <label key={product.id} className="choice">
                  <input type="checkbox" checked={draftPicks.includes(product.title)} onChange={() => setDraftPicks(current => current.includes(product.title) ? current.filter(item => item !== product.title) : [...current, product.title])} />
                  <Image size={16} />
                  <span>{product.title}</span>
                </label>
              ))}
              {catalog.length > 0 && productHits.length === 0 && <p className="muted">No products match.</p>}
            </div>
          </div>
          <div className="modal-actions">
            <span className="muted">{draftPicks.length} {draftPicks.length === 1 ? 'product' : 'products'} selected</span>
            <button type="button" className="ghost" onClick={() => setPicking(false)}>Cancel</button>
            <button type="button" className="solid" onClick={() => { setManual(draftPicks); setPicking(false) }}>Add</button>
          </div>
        </Modal>
      )}
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
        {collection.description && <p className="collection-lead">{collection.description}</p>}
        <div className="order-grid">
          <section className="detail-card">
            <h2>Collection items <span className="muted">{detail.products.length}</span></h2>
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
              {collection.excludes && <p className="muted">{collection.excludes}</p>}
            </section>
            <section className="detail-card">
              <h2>Theme template</h2>
              <p className="muted">{collection.theme || 'Default collection'}</p>
            </section>
            {(collection.seo_title || collection.title) && (
              <section className="detail-card">
                <h2>Search engine listing</h2>
                <div className="seo-preview">
                  <strong>{collection.seo_title || collection.title}</strong>
                  <span>piaci / collections / {slug(collection.title)}</span>
                </div>
              </section>
            )}
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
