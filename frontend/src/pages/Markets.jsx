import { useEffect, useState } from 'react'
import { ChevronRight, CircleDollarSign, Globe, Library, MapPin, Pencil, Percent, Plus, Receipt, RotateCcw, Search, Store, X } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'

const FLAGS = {
  Kenya: '🇰🇪',
  Uganda: '🇺🇬',
  Tanzania: '🇹🇿',
  'United States and Canada': '🇺🇸',
  'European Union': '🇪🇺',
}

const SUGGESTIONS = [
  { name: 'United States and Canada', currency: 'USD' },
  { name: 'European Union', currency: 'EUR' },
]

const CURRENCY = {
  KES: 'Kenyan Shilling (KES)',
  UGX: 'Ugandan Shilling (UGX)',
  TZS: 'Tanzanian Shilling (TZS)',
  USD: 'US Dollar (USD)',
  EUR: 'Euro (EUR)',
}

function MarketDetail({ market, onOpen, onSaved }) {
  const [store] = useJson('/api/store')
  const [pages] = useJson('/api/content')
  const [label, setLabel] = useState(market.name)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setLabel(market.name), [market.name])
  const published = (pages || []).filter(page => page.status === 'visible').length
  const save = patch => {
    fetch(`/api/markets/${market.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not update market')
      const next = await response.json()
      onSaved()
      if (next.name !== market.name) onOpen('markets', { market: next.name })
    }).catch(err => setError(err.message))
  }
  const inherited = [
    [CircleDollarSign, 'Currency', CURRENCY[market.currency] || market.currency],
    [Library, 'Catalogs', 'All products', () => onOpen('catalogs')],
    [Percent, 'Discounts', 'All eligible discounts', () => onOpen('discounts')],
    [Globe, 'Domain / language', `${store?.domain || 'maison.co.ke'} • English`, () => onOpen('store')],
    [Receipt, 'Taxes and duties', 'Collecting sales tax'],
    [RotateCcw, 'Returns and cancellations', 'No rules set'],
    [Store, 'Online Store', store?.theme || 'Dawn', () => onOpen('store')],
    [Library, 'Checkout and accounts', 'Maison configuration', () => onOpen('settings')],
  ]
  return (
    <div className="order-page">
      <div className="orders-top">
        <div className="crumb">
          <button type="button" className="text-link" onClick={() => onOpen('markets')}>Markets</button>
          <span>/</span> {market.name}
        </div>
        <div className="menu-wrap">
          <button type="button" className="ghost" onClick={() => setMenu(value => !value)}>More actions</button>
          {menu && (
            <div className="popover menu-pop">
              <button type="button" onClick={() => onOpen('catalogs')}>View catalogs</button>
              <button type="button" onClick={() => onOpen('store')}>View online store</button>
              <button type="button" onClick={() => onOpen('discounts')}>View discounts</button>
            </div>
          )}
        </div>
      </div>
      <div className="market-title">
        <h1>{market.name}</h1>
        <span className="region-pill">Region</span>
        <span className={`status-pill ${market.status}`}>{market.status[0].toUpperCase()}{market.status.slice(1)}</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="market-detail">
        <div>
          <section className="detail-card">
            <div className="name-status">
              <label className="field">Name
                <input value={label} onChange={e => setLabel(e.target.value)} onBlur={() => label.trim() && label !== market.name && save({ name: label })} />
              </label>
              <label className="field">Status
                <select aria-label="Status" value={market.status} onChange={e => save({ status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
            </div>
            <div className="include-line">
              <span>Includes</span>
              <span className="include-chip">{FLAGS[market.name] || '🌐'} {market.name}</span>
              <button type="button" aria-label="Edit includes"><Pencil size={14} /></button>
            </div>
          </section>
          <h2>Customized</h2>
          <button type="button" className="custom-empty" onClick={() => onOpen('catalogs', { create: '1' })}>Create unique configurations for customers in this market</button>
          <h2>Inherited</h2>
          <section className="detail-card inherit-list">
            {inherited.map(([Icon, title, value, action]) => (
              <div className="inherit-row" key={title}>
                <span><Icon size={15} /> {title}</span>
                <em>→</em>
                {action ? <button type="button" className="text-link" onClick={action}>{value}</button> : <span>{value}</span>}
              </div>
            ))}
          </section>
        </div>
        <aside className="market-side">
          <div className="map-card" aria-hidden="true">
            <MapPin size={16} />
            <i className={market.status === 'active' ? 'on' : ''} />
          </div>
          <section className="detail-card">
            <h2>Parent market</h2>
            <button type="button" className="parent-market" onClick={() => onOpen('markets')}><Store size={14} /> Store default</button>
          </section>
          <section className="detail-card">
            <h2>More settings for {market.name}</h2>
            <button type="button" className="side-link" onClick={() => onOpen('settings', { section: 'shipping' })}>
              <span>Shipping<small>1 rate • Shipping to {market.name}</small></span>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="side-link" onClick={() => onOpen('settings')}>
              <span>Customer privacy<small>Cookie banner, Data sharing opt-out</small></span>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="side-link" onClick={() => onOpen('content')}>
              <span>Policies<small>{published || 1} published</small></span>
              <ChevronRight size={16} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function Markets({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/markets')
  const [query, setQuery] = useState('')
  const [graph, setGraph] = useState(false)
  const [regions, setRegions] = useState(false)
  const [hidden, setHidden] = useState(() => new Set())
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const visible = (rows || []).filter(row => row.name.toLowerCase().includes(query.trim().toLowerCase()))
  const picked = (rows || []).find(row => row.name === focus.market)
  if (focus.market) {
    if (!rows) return <p className="muted">Loading market…</p>
    if (!picked) return <p className="muted">That market is not in the store. <button type="button" className="text-link" onClick={() => onOpen('markets')}>Back to markets</button></p>
    return <MarketDetail market={picked} onOpen={onOpen} onSaved={reload} />
  }
  const suggestions = SUGGESTIONS.filter(item => !(rows || []).some(row => row.name === item.name) && !hidden.has(item.name))
  const add = item => {
    fetch('/api/markets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).then(() => reload())
  }
  return (
    <>
      <div className="orders-top">
        <h1>Markets</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setGraph(value => !value)}>Graph view</button>
          <button type="button" className="solid" onClick={() => setCreating(true)}>Create market</button>
        </div>
      </div>
      <div className="market-layout">
        <aside className="market-rail">
          <button type="button" className={!regions ? 'on' : ''} onClick={() => setRegions(false)}>Store default</button>
          <button type="button" onClick={() => setRegions(value => !value)}><Plus size={14} /> Regions</button>
          {regions && visible.map(row => (
            <button type="button" key={row.id} onClick={() => onOpen('markets', { market: row.name })}>{FLAGS[row.name] || '🌐'} {row.name}</button>
          ))}
        </aside>
        <div className="sheet">
          <div className="toolbar">
            <label className="finder"><Search size={15} /><input placeholder="Search in all markets" value={query} onChange={e => setQuery(e.target.value)} /></label>
          </div>
          {graph ? (
            <div className="market-graph">
              {visible.map(row => (
                <button type="button" key={row.id} onClick={() => onOpen('markets', { market: row.name })}>
                  <strong>{FLAGS[row.name] || '🌐'} {row.name}</strong>
                  <span>{row.currency}</span>
                </button>
              ))}
            </div>
          ) : (
            <table>
              <thead><tr><th>Market</th><th>Status</th><th>Includes</th><th>Customizations</th></tr></thead>
              <tbody>
                {visible.map(row => (
                  <tr key={row.id} className="clickable" onClick={() => onOpen('markets', { market: row.name })}>
                    <td>{FLAGS[row.name] || '🌐'} {row.name}</td>
                    <td><span className={`pill ${row.status}`}>{row.status[0].toUpperCase()}{row.status.slice(1)}</span></td>
                    <td>{FLAGS[row.name] || '🌐'} {row.name}</td>
                    <td />
                  </tr>
                ))}
                {suggestions.map(item => (
                  <tr key={item.name} className="suggest">
                    <td colSpan={3}>
                      <button type="button" className="text-link" onClick={() => add(item)}>Create {item.name} Market <Plus size={14} /></button>
                    </td>
                    <td><button type="button" aria-label={`Dismiss ${item.name}`} onClick={() => setHidden(current => new Set(current).add(item.name))}><X size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/markets" target="_blank" rel="noreferrer">Learn more about markets</a>
      {creating && (
        <Modal title="Create market" onClose={() => setCreating(false)}>
          <form className="modal-form" onSubmit={event => { event.preventDefault(); add({ name, currency }); setCreating(false); setName('') }}>
            <label>Name<input value={name} onChange={e => setName(e.target.value)} required autoFocus /></label>
            <label>Currency<input value={currency} onChange={e => setCurrency(e.target.value)} /></label>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className="solid">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
