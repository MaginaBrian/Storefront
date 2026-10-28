import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Minus, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { marketCatalogs } from '../api/resources.js'
import { csv } from '../lib/csv.js'
import { useJson } from '../lib/api.js'
import { CATALOG_KINDS, catalogError, catalogPayload, catalogPrice } from '../serializers/catalog.js'
import { EmptyPane } from './ui.jsx'

function CatalogMark() {
  return (
    <svg className="empty-mark" viewBox="0 0 120 100" aria-hidden="true">
      <circle cx="60" cy="50" r="34" fill="#f3f6f4" />
      <rect x="38" y="28" width="44" height="36" rx="4" fill="#fff" stroke="#d5e0d8" />
      <circle cx="50" cy="42" r="6" fill="#1f8a5b" />
      <rect x="60" y="38" width="14" height="4" rx="2" fill="#c9ddd2" />
      <rect x="46" y="52" width="26" height="4" rx="2" fill="#c9ddd2" />
    </svg>
  )
}

const money = cents => `KES ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const KIND_NOTE = {
  full: 'This catalog chooses which products customers see and the prices they pay.',
  pricing: 'Products stay the ones published to Online Store. This catalog only changes prices.',
  publication: 'Customers see only the products you include, at store prices in the market currency.',
}

function CatalogEditor({ catalogId, marketName = '', onOpen, onSaved }) {
  const [catalog, setCatalog] = useState(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (!catalogId) return
    marketCatalogs.read(catalogId).then(setCatalog).catch(() => setMissing(true))
  }, [catalogId])
  if (catalogId && !catalog && !missing) return <p className="muted">Loading catalog…</p>
  if (missing) {
    return <p className="muted">That catalog is not in the store. <button type="button" className="text-link" onClick={() => onOpen('catalogs')}>Back to catalogs</button></p>
  }
  return <CatalogForm key={catalog?.id || 'new'} catalog={catalog} marketName={marketName} onOpen={onOpen} onSaved={onSaved} />
}

function CatalogForm({ catalog, marketName, onOpen, onSaved }) {
  const [items] = useJson('/api/catalog-items')
  const [markets] = useJson('/api/markets')
  const [title, setTitle] = useState(catalog?.title || '')
  const [status, setStatus] = useState(catalog?.status || 'active')
  const [kind, setKind] = useState(catalog?.kind || 'full')
  const [chosen, setChosen] = useState(catalog?.markets?.length ? catalog.markets : (marketName ? [marketName] : []))
  const [picking, setPicking] = useState(false)
  const [adjust, setAdjust] = useState(String(Math.abs(catalog?.adjustment || 0)))
  const [direction, setDirection] = useState((catalog?.adjustment || 0) < 0 ? 'Decrease' : 'Increase')
  const [compare, setCompare] = useState(!!catalog?.compare)
  const [auto, setAuto] = useState(catalog ? catalog.auto_include !== false : true)
  const [tab, setTab] = useState('included')
  const [query, setQuery] = useState('')
  const [included, setIncluded] = useState(() => (
    catalog && catalog.auto_include === false ? new Set((catalog.products || []).map(Number)) : null
  ))
  const [prices, setPrices] = useState(() => Object.fromEntries(
    Object.entries(catalog?.prices || {}).map(([id, cents]) => [String(id), Number(cents)])
  ))
  const [editing, setEditing] = useState(null)
  const [draftPrice, setDraftPrice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const rows = items || []
  const pricing = kind !== 'publication'
  const publishing = kind !== 'pricing'
  const includedIds = included || new Set(rows.map(row => row.id))
  const signed = direction === 'Decrease' ? -Math.abs(Number(adjust) || 0) : Math.abs(Number(adjust) || 0)
  const visible = useMemo(() => rows.filter(row => {
    const on = !publishing || includedIds.has(row.id)
    const inTab = !publishing || tab === 'all' || (tab === 'included' ? on : !on)
    return inTab && row.name.toLowerCase().includes(query.trim().toLowerCase())
  }), [rows, includedIds, tab, query, publishing])
  const toggle = id => {
    const next = new Set(includedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setIncluded(next)
    setAuto(false)
  }
  const addMarket = name => {
    setChosen(current => current.includes(name) ? current : [...current, name])
    setPicking(false)
  }
  const commitPrice = (id, raw = draftPrice) => {
    const text = String(raw ?? '')
    const cents = Math.round(Number(text.replace(/,/g, '')) * 100)
    setPrices(current => {
      const next = { ...current }
      if (!text.trim() || !Number.isFinite(cents) || cents < 0) delete next[String(id)]
      else next[String(id)] = cents
      return next
    })
    setEditing(null)
  }
  const save = event => {
    event.preventDefault()
    const message = catalogError({ title, markets: chosen, kind, adjust, auto, included: includedIds })
    if (message) { setError(message); return }
    setBusy(true)
    setError('')
    const body = catalogPayload({
      title, kind, status, markets: chosen, adjust, direction, compare, auto, included: includedIds, prices,
    })
    const request = catalog ? marketCatalogs.patch(catalog.id, body) : marketCatalogs.create(body)
    request.then(saved => {
      onSaved()
      onOpen('catalogs', { catalog: saved.id })
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <form className="order-page" onSubmit={save}>
      <div className="orders-top">
        <div className="crumb">
          <button type="button" className="text-link" onClick={() => onOpen('catalogs')}>Catalogs</button>
          <span>/</span> {catalog ? title || catalog.title : 'New catalog'}
        </div>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <h1 className="catalog-title">{catalog ? title || catalog.title : 'New catalog'}</h1>
      {error && <p className="form-error">{error}</p>}
      <section className="detail-card">
        <div className="market-name-row">
          <label className="field">Title
            <input aria-label="Title" value={title} maxLength={255} onChange={e => setTitle(e.target.value)} />
            <span className="hint count">{title.length}/255</span>
          </label>
          <label className="field">Status
            <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </label>
        </div>
        <label className="field">Catalog
          <select aria-label="Catalog type" value={kind} onChange={e => setKind(e.target.value)}>
            {Object.entries(CATALOG_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <span className="hint">{KIND_NOTE[kind]}</span>
        </label>
        <div className="include-line">
          <span>Markets</span>
          <span className="include-picks">
            {chosen.map(name => (
              <span className="include-chip" key={name}>
                <button type="button" className="text-link" onClick={() => onOpen('markets', { market: name })}>{name}</button>
                <button type="button" aria-label={`Remove ${name}`} onClick={() => setChosen(current => current.filter(item => item !== name))}><X size={12} /></button>
              </span>
            ))}
            <span className="menu-wrap">
              <button type="button" className="text-link" onClick={() => setPicking(value => !value)}><Plus size={14} /> Add a market</button>
              {picking && (
                <div className="popover menu-pop">
                  {(markets || []).filter(row => !chosen.includes(row.name)).map(row => (
                    <button type="button" key={row.id} onClick={() => addMarket(row.name)}>{row.name}</button>
                  ))}
                  {(markets || []).filter(row => !chosen.includes(row.name)).length === 0 && <p className="hint">Every market is already on this catalog.</p>}
                </div>
              )}
            </span>
          </span>
        </div>
      </section>
      {pricing && (
        <>
          <h2>Price list</h2>
          <section className="detail-card">
            <p className="hint">A fixed price on a product overrides this percentage.</p>
            <label className="field">Set prices in
              <select aria-label="Price currency" defaultValue="KES"><option value="KES">Store currency (KES)</option></select>
            </label>
            <div className="adjust-row">
              <span>Price adjustment</span>
              <button type="button" className="icon-btn" aria-label="Decrease adjustment" onClick={() => setAdjust(value => String(Math.max(0, Number(value || 0) - 1)))}><Minus size={14} /></button>
              <input aria-label="Adjustment percent" value={adjust} onChange={e => setAdjust(e.target.value.replace(/[^\d.]/g, ''))} />
              <span>%</span>
              <select aria-label="Adjustment direction" value={direction} onChange={e => setDirection(e.target.value)}>
                <option>Decrease</option>
                <option>Increase</option>
              </select>
              <label className="switch"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Include compare-at price</label>
            </div>
          </section>
        </>
      )}
      {kind === 'publication' && (
        <>
          <h2>Prices</h2>
          <section className="detail-card"><p className="hint">Store prices, shown in the market currency. This catalog does not change them.</p></section>
        </>
      )}
      <div className="orders-top">
        <h2>{publishing ? 'Publication' : 'Products'}</h2>
        <div className="orders-actions">
          {publishing && (
            <label className="switch"><input type="checkbox" checked={auto} onChange={e => { setAuto(e.target.checked); if (e.target.checked) setIncluded(null) }} /> Automatically include new products</label>
          )}
          <button type="button" className="ghost" onClick={() => csv([['Product', 'Detail', 'Price'], ...visible.map(row => [row.name, row.detail, money(catalogPrice(row.price, { kind, adjustment: signed, fixed: prices[String(row.id)] }))])], 'catalog-products.csv')}>Export</button>
        </div>
      </div>
      {kind === 'pricing' && <p className="hint">These products are already published to Online Store. A fixed price here overrides the percentage.</p>}
      <div className="sheet">
        <div className="toolbar">
          {publishing && ['included', 'excluded', 'all'].map(name => (
            <button type="button" key={name} className={tab === name ? 'tab on' : 'tab'} onClick={() => setTab(name)}>{name[0].toUpperCase()}{name.slice(1)}</button>
          ))}
          <label className="finder"><Search size={15} /><input aria-label="Search products" placeholder="Search products" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <button type="button" className="icon-btn" aria-label="Filter products"><SlidersHorizontal size={15} /></button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {publishing && (
                  <th className="check">
                    <input type="checkbox" aria-label="Select products" checked={visible.length > 0 && visible.every(row => includedIds.has(row.id))} onChange={e => { setIncluded(e.target.checked ? new Set(rows.map(row => row.id)) : new Set()); setAuto(false) }} />
                  </th>
                )}
                <th>Product <ChevronDown size={12} className="sort-mark" /></th>
                <th>{pricing ? 'Price in KES' : 'Store price'}</th>
                {pricing && <th>Compare at price</th>}
                <th>Rules</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => {
                const fixed = prices[String(row.id)]
                const price = catalogPrice(row.price, { kind, adjustment: signed, fixed })
                const rule = kind === 'publication' ? 'Store price' : fixed != null ? 'Fixed' : signed ? `${signed > 0 ? '+' : '−'}${Math.abs(signed)}%` : 'Store price'
                return (
                  <tr key={row.id}>
                    {publishing && <td className="check"><input type="checkbox" aria-label={`Include ${row.name}`} checked={includedIds.has(row.id)} onChange={() => toggle(row.id)} /></td>}
                    <td>
                      {row.dest
                        ? <button type="button" className="text-link" onClick={() => onOpen(row.dest, { product: row.name })}>{row.name}</button>
                        : row.name}
                      <small className="product-detail">{row.detail}</small>
                    </td>
                    <td>
                      {pricing && editing === row.id ? (
                        <input className="price-pill" aria-label={`Fixed price for ${row.name}`} value={draftPrice} autoFocus onChange={e => setDraftPrice(e.target.value.replace(/[^\d.]/g, ''))} onBlur={e => commitPrice(row.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitPrice(row.id, e.target.value) } }} />
                      ) : pricing ? (
                        <button type="button" className="price-pill" onClick={() => { setEditing(row.id); setDraftPrice(fixed != null ? (fixed / 100).toFixed(2) : '') }}>{money(price)}</button>
                      ) : <span className="price-pill">{money(price)}</span>}
                    </td>
                    {pricing && <td><span className="price-pill quiet">{compare ? money(row.price) : 'KES'}</span></td>}
                    <td><span className="rule-pill">{rule}</span></td>
                  </tr>
                )
              })}
              {items && visible.length === 0 && <tr><td className="muted" colSpan={publishing ? 5 : 3}>No products in this tab.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  )
}

export function Catalogs({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/market-catalogs')
  const openNew = () => onOpen('catalogs', { create: '1' })
  if (focus.create === '1') return <CatalogEditor key="new" marketName={focus.market || ''} onOpen={onOpen} onSaved={reload} />
  if (focus.catalog) return <CatalogEditor key={focus.catalog} catalogId={focus.catalog} onOpen={onOpen} onSaved={reload} />
  const actions = (
    <>
      <button type="button" className="ghost" onClick={() => csv([['Catalog', 'Type', 'Markets', 'Status'], ...(rows || []).map(row => [row.title, CATALOG_KINDS[row.kind] || row.kind, (row.markets || []).join(', '), row.status])], 'catalogs.csv')}>Export</button>
      <button type="button" className="solid" onClick={openNew}>Create catalog</button>
    </>
  )
  if (!rows) return <p className="muted">Loading catalogs…</p>
  if (rows.length === 0) {
    return (
      <EmptyPane
        title="Catalogs"
        actions={actions}
        heading="Personalize buying with catalogs"
        text="Publish products, price them, or both, for the markets you sell in."
        action="Create catalog"
        onAction={openNew}
        learn="Learn more about catalogs"
        href="https://help.shopify.com/en/manual/b2b/catalogs"
        mark={<CatalogMark />}
      />
    )
  }
  return (
    <>
      <div className="orders-top"><h1>Catalogs</h1><div className="orders-actions">{actions}</div></div>
      <div className="sheet">
        <table>
          <thead><tr><th>Catalog</th><th>Type</th><th>Markets</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="clickable" onClick={() => onOpen('catalogs', { catalog: row.id })}>
                <td>{row.title}</td>
                <td>{CATALOG_KINDS[row.kind] || row.kind}</td>
                <td>{(row.markets || []).map(name => (
                  <button type="button" key={name} className="text-link" onClick={e => { e.stopPropagation(); onOpen('markets', { market: name }) }}>{name}</button>
                ))}</td>
                <td>{row.status === 'draft' ? 'Draft' : 'Active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
