import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
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
  const picked = visible.find(row => row.name === focus.market)
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
      {picked && (
        <section className="handoff">
          <div>
            <h2>{FLAGS[picked.name] || '🌐'} {picked.name}</h2>
            <p>{picked.currency} · {picked.status}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('catalogs')}>Catalogs</button>
        </section>
      )}
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
