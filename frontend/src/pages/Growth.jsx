import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Clock, Info, Plus, Printer } from 'lucide-react'
import { csv } from '../lib/csv.js'
import { useJson } from '../lib/api.js'

const END = new Date('2026-10-15T00:00:00')
const DIRECT = { '2026-09-27': 2, '2026-09-29': 1, '2026-09-30': 1 }
const ORGANIC = { '2026-10-14': 1 }
const RANGES = [
  ['30', 'Last 30 days'],
  ['7', 'Last 7 days'],
  ['90', 'Last 90 days'],
  ['ytd', 'Year to date'],
]
const MODELS = ['Last non-direct click', 'Last click', 'First click', 'Linear']

function iso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dayLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function rangeStart(range) {
  const start = new Date(END)
  if (range === '7') start.setDate(END.getDate() - 6)
  else if (range === '90') start.setDate(END.getDate() - 89)
  else if (range === 'ytd') start.setMonth(0, 1)
  else start.setDate(END.getDate() - 30)
  return start
}

function dailySeries(range) {
  const rows = []
  const cursor = rangeStart(range)
  while (cursor <= END) {
    const key = iso(cursor)
    rows.push({ date: key, direct: DIRECT[key] || 0, organic: ORGANIC[key] || 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return rows
}

function weeklySeries(days) {
  const buckets = []
  days.forEach(row => {
    const date = new Date(`${row.date}T00:00:00`)
    const start = new Date(date)
    start.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const key = iso(start)
    const bucket = buckets.find(item => item.date === key)
    if (bucket) {
      bucket.direct += row.direct
      bucket.organic += row.organic
    } else buckets.push({ date: key, direct: row.direct, organic: row.organic })
  })
  return buckets
}

function smooth(points) {
  if (points.length < 2) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return path
}

function SessionChart({ series, channel }) {
  const width = 760
  const height = 230
  const pad = { l: 32, r: 8, t: 12, b: 28 }
  const maxY = Math.max(2, ...series.map(row => Math.max(row.direct, row.organic)))
  const x = index => pad.l + (series.length <= 1 ? 0 : (index / (series.length - 1)) * (width - pad.l - pad.r))
  const y = value => pad.t + (height - pad.t - pad.b) * (1 - value / maxY)
  const ticks = maxY <= 2 ? [0, 0.5, 1, 1.5, 2] : [0, Math.round(maxY / 2), maxY]
  const step = Math.max(1, Math.ceil(series.length / 16))
  const line = key => smooth(series.map((row, index) => ({ x: x(index), y: y(row[key]) })))
  return (
    <svg className="attr-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sessions by channel over time">
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} />
          <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end">{tick}</text>
        </g>
      ))}
      {channel !== 'organic' && <path d={line('direct')} className="direct" />}
      {channel !== 'direct' && <path d={line('organic')} className="organic" />}
      {series.map((row, index) => index % step === 0 && (
        <text key={row.date} className="axis-label" x={x(index)} y={height - 6} textAnchor="middle">{dayLabel(row.date)}</text>
      ))}
    </svg>
  )
}

function FolderArt() {
  return (
    <svg className="empty-mark" viewBox="0 0 160 120" aria-hidden="true">
      <rect x="18" y="28" width="124" height="78" rx="10" fill="#dbe7ff" />
      <path d="M18 42h46l10 12h68v52a10 10 0 0 1-10 10H28a10 10 0 0 1-10-10V42z" fill="#3b82f6" />
      <circle cx="108" cy="72" r="18" fill="none" stroke="#fff" strokeWidth="8" />
      <circle cx="108" cy="72" r="18" fill="none" stroke="#93c5fd" strokeWidth="8" strokeDasharray="40 80" transform="rotate(-40 108 72)" />
      <rect x="42" y="58" width="36" height="6" rx="3" fill="#dbeafe" />
      <rect x="42" y="72" width="24" height="6" rx="3" fill="#bfdbfe" />
    </svg>
  )
}

export function Attribution({ focus = {}, onOpen }) {
  const [range, setRange] = useState('30')
  const [grain, setGrain] = useState('daily')
  const [channel, setChannel] = useState(focus.channel || 'all')
  const [metric, setMetric] = useState('sessions')
  const [model, setModel] = useState(MODELS[0])
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [note, setNote] = useState(false)
  useEffect(() => {
    if (focus.channel) setChannel(focus.channel)
  }, [focus.channel, focus.tick])
  const series = useMemo(() => {
    const days = dailySeries(range)
    return grain === 'weekly' ? weeklySeries(days) : days
  }, [range, grain])
  const totals = series.reduce((sum, row) => ({
    direct: sum.direct + row.direct,
    organic: sum.organic + row.organic,
  }), { direct: 0, organic: 0 })
  const rows = [
    { id: 'direct', name: 'Direct', type: 'Direct', sessions: totals.direct },
    { id: 'organic', name: 'Storefront organic', type: 'Organic', sessions: totals.organic },
  ].filter(row => channel === 'all' || row.id === channel)
  const exportRows = () => csv([
    ['Channel', 'Type', 'Sessions', 'Sales', 'Orders', 'Conversion rate', 'Orders from new customers', 'Orders from returning customers'],
    ...rows.map(row => [row.name, row.type, row.sessions, 'KES 0.00', 0, '0%', 0, 0]),
  ], 'attribution.csv', { excel: true })
  return (
    <>
      <div className="orders-top">
        <div className="title-row">
          <h1>Attribution</h1>
          <div className="menu">
            <button type="button" className="ghost" aria-expanded={channelsOpen} onClick={() => setChannelsOpen(open => !open)}>Channels <ChevronDown size={14} /></button>
            {channelsOpen && (
              <div className="popover menu-pop">
                {[['all', 'All channels'], ['direct', 'Direct'], ['organic', 'Storefront organic']].map(([id, label]) => (
                  <button type="button" key={id} onClick={() => { setChannel(id); setChannelsOpen(false) }}>{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => window.print()}><Printer size={14} /> Print</button>
          <button type="button" className="ghost" onClick={exportRows}>Export</button>
        </div>
      </div>
      <div className="analytics-filters">
        <select aria-label="Date range" value={range} onChange={e => setRange(e.target.value)}>
          {RANGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select aria-label="Chart grain" value={grain} onChange={e => setGrain(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <span className="date-chip">{model}</span>
        <select aria-label="Attribution model" value={model} onChange={e => setModel(e.target.value)}>
          {MODELS.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>
      <section className="chart-card attr-card">
        <select aria-label="Chart metric" value={metric} onChange={e => setMetric(e.target.value)}>
          <option value="sessions">Sessions by top 5 channels over time</option>
          <option value="sales">Sales by top 5 channels over time</option>
        </select>
        {metric === 'sessions'
          ? <SessionChart series={series} channel={channel} />
          : <p className="muted chart-empty">No sales in this range. Sessions are recorded, and none of them placed an order.</p>}
        <p className="legend">
          {channel !== 'organic' && <><i className="swatch direct" /> Direct</>}
          {channel !== 'direct' && <><i className="swatch organic" /> Storefront organic</>}
        </p>
      </section>
      <div className="info-banner">
        <Info size={16} />
        <p>Cost, click, and impression metrics are now available for supported marketing apps. <button type="button" className="text-link" onClick={() => setNote(open => !open)}>Learn more</button></p>
      </div>
      {note && <p className="muted">Connect a marketing app to fill cost, ROAS, CPA, and CTR. Sessions and orders already come from this store.</p>}
      <div className="sheet attr-sheet">
        <table>
          <thead>
            <tr>
              {['Channel', 'Type', 'Sessions', 'Sales', 'Orders', 'Conversion rate', 'Cost', 'ROAS', 'CPA', 'CTR', 'AOV', 'Orders from new customers', 'Orders from returning customers'].map(label => <th key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td><button type="button" className="text-link" onClick={() => onOpen('campaigns')}>{row.name}</button></td>
                <td>{row.type}</td>
                <td>{row.sessions}</td>
                <td>KES 0.00</td>
                <td>0</td>
                <td>0%</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                <td>0</td>
                <td>0</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Autopilot({ onOpen }) {
  const [regions, setRegions] = useState(['Kenya'])
  const [languages, setLanguages] = useState(['English'])
  const [roas, setRoas] = useState('')
  const [cac, setCac] = useState('')
  const [showRoas, setShowRoas] = useState(false)
  const [showCac, setShowCac] = useState(false)
  const [createAsk, setCreateAsk] = useState('Always ask')
  const [updateAsk, setUpdateAsk] = useState('Always allow')
  const [channels, setChannels] = useState([])
  const [picker, setPicker] = useState(false)
  return (
    <>
      <div className="orders-top"><h1>Campaign Autopilot</h1></div>
      <div className="warn-banner">
        <strong>Complete your store setup to use Autopilot</strong>
        <p>Autopilot can't run campaigns yet. Complete this setup step to continue: remove your store password. <button type="button" className="text-link" onClick={() => onOpen('settings', { section: 'general' })}>Open settings</button></p>
      </div>
      <div className="autopilot">
        <div>
          <h2>Autopilot is analyzing your store's catalog, pricing, profit margins, and sales history to identify performance trends and uncover opportunities to grow.</h2>
          <h3 className="with-icon"><Clock size={16} /> Activity</h3>
          <p className="muted">Yesterday</p>
          <ul className="activity">
            <li><i /> Analyzing your sales in the last 30 days <time>4:19 PM</time></li>
            <li><i /> Analyzing your store's catalogue and inventory <time>4:19 PM</time></li>
            <li><i className="live" /> Autopilot is initializing <time>4:19 PM</time></li>
          </ul>
        </div>
        <aside className="autopilot-side">
          <h3>Configuration</h3>
          <p className="side-label">Guardrails</p>
          <label>Regions
            <span className="chip-row">
              {regions.map(region => <span className="quiet-tag" key={region}>{region}</span>)}
              <select aria-label="Add region" value="" onChange={e => { if (e.target.value && !regions.includes(e.target.value)) setRegions([...regions, e.target.value]) }}>
                <option value="">Add</option>
                {['Kenya', 'Uganda', 'Tanzania'].map(region => <option key={region}>{region}</option>)}
              </select>
            </span>
          </label>
          <label>Languages
            <span className="chip-row">
              {languages.map(language => <span className="quiet-tag" key={language}>{language}</span>)}
              <select aria-label="Add language" value="" onChange={e => { if (e.target.value && !languages.includes(e.target.value)) setLanguages([...languages, e.target.value]) }}>
                <option value="">Add</option>
                {['English', 'Swahili'].map(language => <option key={language}>{language}</option>)}
              </select>
            </span>
          </label>
          {showRoas
            ? <label>Target return on ad spend <input inputMode="decimal" value={roas} onChange={e => setRoas(e.target.value.replace(/[^\d.]/g, ''))} placeholder="3" /></label>
            : <button type="button" className="text-link" onClick={() => setShowRoas(true)}>+ Target return on ad spend</button>}
          {showCac
            ? <label>Customer acquisition cost <input inputMode="decimal" value={cac} onChange={e => setCac(e.target.value.replace(/[^\d.]/g, ''))} placeholder="KES" /></label>
            : <button type="button" className="text-link" onClick={() => setShowCac(true)}>+ Customer acquisition cost</button>}
          <p className="side-label">Permissions</p>
          <label>Create campaign
            <select value={createAsk} onChange={e => setCreateAsk(e.target.value)}>
              <option>Always ask</option>
              <option>Always allow</option>
            </select>
          </label>
          <label>Update campaign
            <select value={updateAsk} onChange={e => setUpdateAsk(e.target.value)}>
              <option>Always allow</option>
              <option>Always ask</option>
            </select>
          </label>
          <div className="between">
            <p className="side-label">Connect to a channel</p>
            <button type="button" className="icon-btn" aria-label="Connect a channel" onClick={() => setPicker(open => !open)}><Plus size={16} /></button>
          </div>
          {channels.map(name => <span className="quiet-tag" key={name}>{name}</span>)}
          {picker && (
            <div className="picker">
              {['Online Store', 'WhatsApp', 'Instagram'].filter(name => !channels.includes(name)).map(name => (
                <button type="button" key={name} onClick={() => { setChannels([...channels, name]); setPicker(false) }}>{name}</button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

function campaignCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(3))
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function CampaignEditor({ campaign, onOpen, onSaved }) {
  const existing = Boolean(campaign?.id)
  const [code] = useState(campaign?.id || campaignCode)
  const [name, setName] = useState(campaign?.name || '')
  const [savedName, setSavedName] = useState(campaign?.name || '')
  const [range, setRange] = useState('ytd')
  const [error, setError] = useState('')
  const [rules, setRules] = useState(false)
  const [activity, setActivity] = useState(false)
  const dirty = !existing || name !== savedName
  const link = `/?utm_campaign=${code}&utm_source=campaign`
  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a campaign name.'); return }
    const request = existing
      ? fetch(`/api/campaigns/${code}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) })
      : fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: code, name: trimmed }) })
    request.then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not save this campaign')
      setSavedName(body.name)
      setName(body.name)
      setError('')
      onSaved()
      onOpen('campaigns', { campaign: body.id })
    }).catch(err => setError(err.message))
  }
  return (
    <>
      <div className="crumb">
        <button type="button" onClick={() => onOpen('campaigns')}>Campaigns</button>
        <span>/</span>
        <strong>{existing ? savedName || 'Campaign' : 'Create campaign'}</strong>
        <span className="pill draft">Draft</span>
      </div>
      {dirty && (
        <div className="unsaved">
          <span>Unsaved changes</span>
          <button type="button" onClick={() => (existing ? setName(savedName) : onOpen('campaigns'))}>Discard</button>
          <button type="button" className="solid" onClick={save}>Save</button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="campaign-layout">
        <div>
          <select aria-label="Campaign date range" value={range} onChange={e => setRange(e.target.value)}>
            <option value="ytd">Year to date</option>
            <option value="30">Last 30 days</option>
            <option value="7">Last 7 days</option>
          </select>
          <div className="metric-grid">
            {['Sessions', 'Total sales', 'Orders', 'Average order value'].map(label => (
              <article key={label} className="metric"><h3>{label}</h3><p>No data for this date range</p></article>
            ))}
          </div>
          <div className="metric-grid charts">
            {['Sessions by channel', 'Total sales by channel', 'Sessions by UTM parameters', 'Total sales by UTM parameters'].map(label => (
              <article key={label} className="metric tall"><h3>{label}</h3><p>No data for this date range</p></article>
            ))}
          </div>
        </div>
        <aside className="campaign-side">
          <span className="date-chip">Last non-direct click</span>
          <label>Campaign name
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <p className="side-label">ID</p>
          <p className="mono">{code}</p>
          <p className="side-label">Shareable links</p>
          <p className="mono">{link}</p>
          <button type="button" className="text-link" onClick={() => navigator.clipboard?.writeText(`${location.origin}${link}`)}>Copy link</button>
          <div className="between">
            <p className="side-label">Auto-match rules</p>
          </div>
          <button type="button" className="block-link" onClick={() => setRules(open => !open)}>Create rules to automatically assign traffic</button>
          {rules && <p className="muted">A rule can match a UTM campaign, source, or the shareable link above and attach those sessions to this campaign.</p>}
          <p className="side-label">Campaign activities</p>
          <button type="button" className="block-link" onClick={() => setActivity(open => !open)}>Manually assign existing marketing traffic</button>
          {activity && <p className="muted">The unassigned Storefront organic session on Oct 14 can be attached here after you save the campaign.</p>}
        </aside>
      </div>
    </>
  )
}

export function Campaigns({ focus = {}, onOpen }) {
  const [rows, reload, error] = useJson('/api/campaigns')
  const [learn, setLearn] = useState(false)
  const [current, setCurrent] = useState(null)
  useEffect(() => {
    if (!focus.campaign) { setCurrent(null); return }
    fetch(`/api/campaigns/${encodeURIComponent(focus.campaign)}`).then(r => r.ok ? r.json() : null).then(setCurrent)
  }, [focus.campaign, focus.tick])
  if (focus.create === '1') return <CampaignEditor onOpen={onOpen} onSaved={reload} />
  if (focus.campaign) {
    if (!current) return <p className="muted">{error || 'Loading campaign…'}</p>
    return <CampaignEditor campaign={current} onOpen={onOpen} onSaved={reload} />
  }
  return (
    <>
      <div className="orders-top">
        <h1>Campaigns</h1>
        <button type="button" className="solid" onClick={() => onOpen('campaigns', { create: '1' })}>Create campaign</button>
      </div>
      <button type="button" className="unassigned" onClick={() => onOpen('attribution', { channel: 'organic' })}>1 unassigned activity</button>
      {!rows && <p className="muted">Loading campaigns…</p>}
      {rows && rows.length === 0 && (
        <section className="panel empty-hero">
          <div>
            <h2>Centralize your campaign tracking</h2>
            <p>Create campaigns to evaluate how marketing initiatives drive business goals. Capture online and offline touchpoints, add campaign activities from multiple marketing channels, and monitor results.</p>
            <div className="orders-actions">
              <button type="button" className="solid" onClick={() => onOpen('campaigns', { create: '1' })}>Create campaign</button>
              <button type="button" className="ghost" onClick={() => setLearn(open => !open)}>Learn more</button>
            </div>
            {learn && <p>A campaign collects sessions that share a name, a link, or a channel. Sales stay at zero until an order is tied to that campaign.</p>}
          </div>
          <FolderArt />
        </section>
      )}
      {rows && rows.length > 0 && (
        <div className="sheet">
          <table>
            <thead><tr><th>Campaign</th><th>Status</th><th>ID</th><th>Created</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td><button type="button" className="text-link" onClick={() => onOpen('campaigns', { campaign: row.id })}>{row.name}</button></td>
                  <td><span className="pill draft">{row.status}</span></td>
                  <td className="mono">{row.id}</td>
                  <td>{row.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
