import { useMemo, useState } from 'react'
import { ChevronDown, Minus, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { csv } from '../lib/csv.js'
import { useJson } from '../lib/api.js'
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

const kes = cents => `KES ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function NewCatalog({ onOpen, onSaved }) {
  const [items] = useJson('/api/catalog-items')
  const [markets] = useJson('/api/markets')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('Active')
  const [chosen, setChosen] = useState([])
  const [picking, setPicking] = useState(false)
  const [adjust, setAdjust] = useState('0')
  const [direction, setDirection] = useState('Decrease')
  const [compare, setCompare] = useState(false)
  const [auto, setAuto] = useState(true)
  const [tab, setTab] = useState('included')
  const [query, setQuery] = useState('')
  const [included, setIncluded] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const rows = items || []
  const includedIds = included || new Set(rows.map(row => row.id))
  const visible = useMemo(() => rows.filter(row => {
    const on = includedIds.has(row.id)
    const inTab = tab === 'all' || (tab === 'included' ? on : !on)
    return inTab && row.name.toLowerCase().includes(query.trim().toLowerCase())
  }), [rows, includedIds, tab, query])
  const toggle = id => {
    const next = new Set(includedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setIncluded(next)
  }
  const addMarket = name => {
    setChosen(current => current.includes(name) ? current : [...current, name])
    setPicking(false)
  }
  const save = () => {
    if (!title.trim()) { setError('Enter a catalog title.'); return }
    setBusy(true)
    fetch('/api/market-catalogs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, market: chosen[0] || 'Kenya' }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not create catalog')
      onSaved()
      onOpen('catalogs')
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <div className="order-page">
      <div className="orders-top">
        <div className="crumb">
          <button type="button" className="text-link" onClick={() => onOpen('catalogs')}>Catalogs</button>
          <span>/</span> New catalog
        </div>
        <button type="button" className="solid" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <h1 className="catalog-title">New catalog</h1>
      {error && <p className="form-error">{error}</p>}
      <section className="detail-card">
        <div className="name-status">
          <label className="field">Title
            <input value={title} maxLength={255} onChange={e => setTitle(e.target.value)} />
            <span className="hint count">{title.length}/255</span>
          </label>
          <label className="field">Status
            <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}>
              <option>Active</option>
              <option>Draft</option>
            </select>
          </label>
        </div>
        <div className="include-line">
          <span>Markets</span>
          {chosen.map(name => (
            <button type="button" key={name} className="include-chip" onClick={() => onOpen('markets', { market: name })}>{name}</button>
          ))}
          <button type="button" className="text-link" onClick={() => setPicking(value => !value)}><Plus size={14} /> Add a market</button>
        </div>
        {picking && (
          <div className="match-list">
            {(markets || []).filter(row => !chosen.includes(row.name)).map(row => (
              <button type="button" key={row.id} onClick={() => addMarket(row.name)}>{row.name}</button>
            ))}
          </div>
        )}
      </section>
      <h2>Pricing</h2>
      <section className="detail-card">
        <label className="field">Set prices in
          <select defaultValue="KES"><option value="KES">Store currency (KES)</option></select>
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
      <div className="orders-top">
        <h2>Products</h2>
        <div className="orders-actions">
          <label className="switch"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Automatically include new products</label>
          <button type="button" className="ghost" onClick={() => csv([['Product', 'Detail', 'Price'], ...visible.map(row => [row.name, row.detail, kes(row.price)])], 'catalog-products.csv')}>Export</button>
          <button type="button" className="ghost">Import</button>
        </div>
      </div>
      <div className="sheet">
        <div className="toolbar">
          {['included', 'excluded', 'all'].map(name => (
            <button type="button" key={name} className={tab === name ? 'tab on' : 'tab'} onClick={() => setTab(name)}>{name[0].toUpperCase()}{name.slice(1)}</button>
          ))}
          <label className="finder"><Search size={15} /><input placeholder="Search products" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <button type="button" className="icon-btn" aria-label="Filter products"><SlidersHorizontal size={15} /></button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input type="checkbox" aria-label="Select products" checked={visible.length > 0 && visible.every(row => includedIds.has(row.id))} onChange={e => setIncluded(e.target.checked ? new Set(rows.map(row => row.id)) : new Set())} /></th>
                <th>Product <ChevronDown size={12} className="sort-mark" /></th>
                <th>Price in KES</th>
                <th>Compare at price</th>
                <th>Rules</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id}>
                  <td className="check"><input type="checkbox" aria-label={`Include ${row.name}`} checked={includedIds.has(row.id)} onChange={() => toggle(row.id)} /></td>
                  <td>
                    {row.dest
                      ? <button type="button" className="text-link" onClick={() => onOpen(row.dest, { product: row.name })}>{row.name}</button>
                      : row.name}
                    <small className="product-detail">{row.detail}</small>
                  </td>
                  <td><span className="price-pill">{kes(row.price)}</span></td>
                  <td><span className="price-pill quiet">{compare ? kes(row.price) : 'KES'}</span></td>
                  <td><button type="button" className="rule-pill" aria-label={`Rules for ${row.name}`} /></td>
                </tr>
              ))}
              {items && visible.length === 0 && <tr><td className="muted" colSpan={5}>No products in this tab.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function Catalogs({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/market-catalogs')
  const openNew = () => onOpen('catalogs', { create: '1' })
  if (focus.create === '1') return <NewCatalog onOpen={onOpen} onSaved={reload} />
  const actions = (
    <>
      <button type="button" className="ghost" onClick={() => csv([['Catalog', 'Market'], ...(rows || []).map(row => [row.title, row.market])], 'catalogs.csv')}>Export</button>
      <button type="button" className="ghost" onClick={openNew}>Import</button>
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
        text="Create custom product and pricing offerings for your customers with catalogs."
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
          <thead><tr><th>Catalog</th><th>Market</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td><button type="button" className="text-link" onClick={() => onOpen('markets', { market: row.market })}>{row.market}</button></td>
                <td>Active</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
