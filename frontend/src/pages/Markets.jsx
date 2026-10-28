import { useEffect, useState } from 'react'
import { ChevronLeft, CircleDollarSign, Eye, Globe, Info, Library, MapPin, Percent, Plus, Search, Store, Truck, X } from 'lucide-react'
import { markets as marketApi } from '../api/resources.js'
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

const CONDITIONS = [
  { name: 'Kenya', currency: 'KES' },
  { name: 'Uganda', currency: 'UGX' },
  { name: 'Tanzania', currency: 'TZS' },
  ...SUGGESTIONS,
]

const CURRENCY = {
  KES: 'Kenyan Shilling (KES)',
  UGX: 'Ugandan Shilling (UGX)',
  TZS: 'Tanzanian Shilling (TZS)',
  USD: 'US Dollar (USD)',
  EUR: 'Euro (EUR)',
}

function MarketEditor({ market, onOpen, onSaved }) {
  const creating = !market
  const [store] = useJson('/api/store')
  const [settings] = useJson('/api/settings')
  const [name, setName] = useState(market?.name || '')
  const [status, setStatus] = useState(market?.status || 'active')
  const [includes, setIncludes] = useState(market?.includes || (market ? market.name : ''))
  const [currency, setCurrency] = useState(market?.currency || 'KES')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const storeName = (settings || []).find(row => row.key === 'store_name')?.value || 'Maison'
  useEffect(() => {
    setName(market?.name || '')
    setStatus(market?.status || 'active')
    setIncludes(market?.includes || (market ? market.name : ''))
    setCurrency(market?.currency || 'KES')
  }, [market])
  const inherited = [
    [CircleDollarSign, 'Currency', CURRENCY[currency] || currency, null],
    [Library, 'Catalogs', 'All products', () => onOpen('catalogs')],
    [Percent, 'Discounts', 'All eligible discounts', () => onOpen('discounts')],
    [Globe, 'Domain / language', `${store?.domain || 'maison.co.ke'} · English`, () => onOpen('store')],
    [Truck, 'Shipping', 'Not shipping', () => onOpen('settings', { section: 'shipping' })],
    [Store, 'Online Store', store?.theme || 'Dawn', () => onOpen('store')],
    [Library, 'Checkout and accounts', `${storeName} configuration`, () => onOpen('settings')],
  ]
  const persist = patch => {
    if (!market) return
    marketApi.patch(market.id, patch).then(next => {
      onSaved()
      if (next.name !== market.name) onOpen('markets', { market: next.name })
    }).catch(err => setError(err.message))
  }
  const choose = item => {
    setIncludes(item.name)
    setCurrency(item.currency)
    setAdding(false)
    persist({ includes: item.name, currency: item.currency, name: name.trim() || market?.name || item.name, status })
  }
  const clearInclude = () => {
    setIncludes('')
    persist({ includes: '', name: name.trim() || market?.name || '', status, currency })
  }
  const save = event => {
    event.preventDefault()
    if (!name.trim()) { setError('Enter a market name.'); return }
    setBusy(true)
    setError('')
    const body = { name: name.trim(), currency, status, includes }
    const request = market ? marketApi.patch(market.id, body) : marketApi.create(body)
    request.then(next => {
      if (!next?.name) throw new Error('Could not save this market.')
      onSaved()
      onOpen('markets', { market: next.name })
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  const label = status === 'active' ? 'Active' : 'Draft'
  return (
    <form className="order-page" onSubmit={save}>
      <div className="crumb">
        <button type="button" className="icon-btn" aria-label="Markets" onClick={() => onOpen('markets')}><ChevronLeft size={16} /></button>
        <button type="button" className="text-link" onClick={() => onOpen('markets')}>Markets</button>
        <span>/</span><span>{creating ? 'New market' : name || market.name}</span>
      </div>
      <div className="market-title">
        <h1>{creating ? 'New market' : name || market.name}</h1>
        <span className={`status-pill ${status}`}>{label}</span>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="market-detail">
        <div>
          <section className="detail-card">
            <div className="market-name-row">
              <label className="field">Name
                <input aria-label="Name" placeholder="Name" value={name} onChange={e => setName(e.target.value)} onBlur={() => market && name.trim() && name !== market.name && persist({ name: name.trim(), status, currency, includes })} />
              </label>
              <select aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); persist({ status: e.target.value, name: name.trim() || market?.name, currency, includes }) }}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="include-line">
              <span>Includes</span>
              {includes ? (
                <span className="include-chip">{FLAGS[includes] || '🌐'} {includes} <button type="button" aria-label="Remove condition" onClick={clearInclude}><X size={12} /></button></span>
              ) : (
                <span className="menu-wrap">
                  <button type="button" className="text-link" onClick={() => setAdding(open => !open)}><Plus size={14} /> Add condition</button>
                  {adding && (
                    <div className="popover menu-pop">
                      {CONDITIONS.map(item => (
                        <button type="button" key={item.name} onClick={() => choose(item)}>{FLAGS[item.name] || '🌐'} {item.name}</button>
                      ))}
                    </div>
                  )}
                </span>
              )}
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
                <span>{value}</span>
                {action ? <button type="button" className="icon-btn" aria-label={`Open ${title}`} onClick={action}><Eye size={15} /></button> : <span />}
              </div>
            ))}
          </section>
        </div>
        <aside className="market-side">
          <div className="map-card" aria-hidden="true">
            <MapPin size={16} />
            <span className="hier-line" />
            <span className="hier-node">{creating ? '' : (FLAGS[includes || name] || '🌐')}</span>
          </div>
          {creating
            ? <p className="hier-note"><Info size={14} /> Save to show market hierarchy</p>
            : <p className="hier-note"><Store size={14} /> Store default</p>}
        </aside>
      </div>
    </form>
  )
}

export function Markets({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/markets')
  const [query, setQuery] = useState('')
  const [graph, setGraph] = useState(false)
  const [regions, setRegions] = useState(false)
  const [hidden, setHidden] = useState(() => new Set())
  const visible = (rows || []).filter(row => row.name.toLowerCase().includes(query.trim().toLowerCase()))
  const picked = (rows || []).find(row => row.name === focus.market)
  if (focus.create) return <MarketEditor onOpen={onOpen} onSaved={reload} />
  if (focus.market) {
    if (!rows) return <p className="muted">Loading market…</p>
    if (!picked) return <p className="muted">That market is not in the store. <button type="button" className="text-link" onClick={() => onOpen('markets')}>Back to markets</button></p>
    return <MarketEditor market={picked} onOpen={onOpen} onSaved={reload} />
  }
  const suggestions = SUGGESTIONS.filter(item => !(rows || []).some(row => row.name === item.name) && !hidden.has(item.name))
  const add = item => marketApi.create(item).then(() => reload())
  return (
    <>
      <div className="orders-top">
        <h1>Markets</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setGraph(value => !value)}>Graph view</button>
          <button type="button" className="solid" onClick={() => onOpen('markets', { create: '1' })}>Create market</button>
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
                    <td>{FLAGS[row.includes || row.name] || '🌐'} {row.includes || row.name}</td>
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
    </>
  )
}
