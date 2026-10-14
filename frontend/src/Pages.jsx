import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

const money = cents => `KES ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function useApi(path) {
  const [data, setData] = useState(null)
  const load = () => fetch(path).then(r => r.json()).then(setData)
  useEffect(() => { load() }, [path])
  return [data, load]
}

function Sheet({ title, action, columns, rows, empty }) {
  return (
    <>
      <div className="page-head">
        <h1 className="title">{title}</h1>
        {action}
      </div>
      <div className="card">
        <table>
          <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows?.map(row => (
              <tr key={row.id}>
                {columns.map(c => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </tr>
            ))}
            {rows && rows.length === 0 && <tr><td className="muted" colSpan={columns.length}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

const Status = ({ value }) => <span className={`pill ${value}`}>{value}</span>

export function Products({ boot }) {
  const [rows, reload] = useApi('/api/products')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (boot?.id === 'add') setOpen(true) }, [boot])

  const save = e => {
    e.preventDefault()
    const cents = Math.round(Number(price) * 100)
    if (!title.trim() || !Number.isFinite(cents) || cents < 0) { setError('Enter a name and a valid price.'); return }
    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), price: cents, stock: Number(stock) || 0 }),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      setOpen(false)
      setTitle(''); setPrice(''); setStock(''); setError('')
      reload()
    }).catch(err => setError(err.message))
  }

  return (
    <>
      <Sheet
        title="Products"
        rows={rows}
        empty="No products yet."
        action={<button type="button" className="cta" onClick={() => setOpen(true)}><Plus size={15} /> Add product</button>}
        columns={[
          { key: 'title', label: 'Product' },
          { key: 'price', label: 'Price', render: r => money(r.price) },
          { key: 'stock', label: 'In stock' },
          { key: 'sold', label: 'Sold' },
        ]}
      />
      {open && (
        <div className="backdrop" onClick={() => setOpen(false)}>
          <form className="modal-form card pop" onClick={e => e.stopPropagation()} onSubmit={save}>
            <h2>Add product</h2>
            <label>Name<input autoFocus value={title} onChange={e => setTitle(e.target.value)} /></label>
            <label>Price (KES)<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label>
            <label>In stock<input inputMode="numeric" value={stock} onChange={e => setStock(e.target.value)} /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="solid">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export function Customers() {
  const [rows] = useApi('/api/customers')
  return (
    <Sheet title="Customers" rows={rows} empty="No customers yet." columns={[
      { key: 'name', label: 'Customer' },
      { key: 'email', label: 'Email', render: r => r.email || '—' },
      { key: 'location', label: 'Location' },
      { key: 'orders', label: 'Orders' },
      { key: 'spent', label: 'Spent', render: r => money(r.spent) },
    ]} />
  )
}

export function Discounts() {
  const [rows] = useApi('/api/discounts')
  return (
    <Sheet title="Discounts" rows={rows} empty="No discounts yet." columns={[
      { key: 'code', label: 'Code' },
      { key: 'kind', label: 'Type' },
      { key: 'value', label: 'Value' },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      { key: 'uses', label: 'Uses' },
    ]} />
  )
}

export function Content() {
  const [rows] = useApi('/api/content')
  return (
    <Sheet title="Content" rows={rows} empty="No pages yet." columns={[
      { key: 'title', label: 'Page' },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      { key: 'updated_at', label: 'Updated' },
    ]} />
  )
}

export function Markets() {
  const [rows] = useApi('/api/markets')
  return (
    <Sheet title="Markets" rows={rows} empty="No markets yet." columns={[
      { key: 'name', label: 'Market' },
      { key: 'currency', label: 'Currency' },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
    ]} />
  )
}

export function Growth() {
  const [rows] = useApi('/api/growth')
  return (
    <Sheet title="Growth" rows={rows} empty="No campaigns yet." columns={[
      { key: 'name', label: 'Campaign' },
      { key: 'channel', label: 'Channel' },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      { key: 'reach', label: 'Reach', render: r => r.reach.toLocaleString() },
    ]} />
  )
}

export function Analytics({ onOpen }) {
  const [data] = useApi('/api/analytics')
  if (!data) return null
  return (
    <>
      <h1 className="title">Analytics</h1>
      <div className="card">
        <h3>Sales by channel</h3>
        <table>
          <thead><tr><th>Channel</th><th>Orders</th><th>Sales</th><th>Change</th></tr></thead>
          <tbody>
            {data.channels.map(c => (
              <tr key={c.name}>
                <td><button type="button" className="text-link" onClick={() => onOpen(c.view)}>{c.name}</button></td>
                <td>{c.orders.toLocaleString()}</td>
                <td>KES {c.sales.toLocaleString()}</td>
                <td><em className={c.delta > 0 ? 'up' : 'down'}>{Math.abs(c.delta)}%</em></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function StorePage() {
  const [store] = useApi('/api/store')
  if (!store) return null
  return (
    <>
      <h1 className="title">Online Store</h1>
      <section className="kpis">
        {[['Domain', store.domain], ['Theme', store.theme], ['Status', store.status]].map(([k, v]) => (
          <div className="card kpi" key={k}><span className="muted">{k}</span><strong className="store-val">{v}</strong></div>
        ))}
      </section>
    </>
  )
}

export function AgenticPage() {
  const [row] = useApi('/api/agentic')
  if (!row) return null
  const rate = Math.round((row.resolved / row.conversations) * 100)
  return (
    <>
      <h1 className="title">Agentic</h1>
      <section className="kpis">
        {[['Conversations', row.conversations], ['Resolved', row.resolved], ['Handed off', row.handoff], ['Resolution', `${rate}%`]].map(([k, v]) => (
          <div className="card kpi" key={k}><span className="muted">{k}</span><strong className="store-val">{v}</strong></div>
        ))}
      </section>
    </>
  )
}

export function Settings() {
  const [rows, reload] = useApi('/api/settings')
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (rows) setForm(Object.fromEntries(rows.map(r => [r.key, r.value])))
  }, [rows])
  if (!form) return null
  const save = e => {
    e.preventDefault()
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => { if (!r.ok) throw new Error(); setSaved(true); reload() }).catch(() => setSaved(false))
  }
  return (
    <>
      <h1 className="title">Settings</h1>
      <form className="card settings" onSubmit={save}>
        {rows.map(r => (
          <label key={r.key}>{r.label}
            <input value={form[r.key] ?? ''} onChange={e => { setSaved(false); setForm(f => ({ ...f, [r.key]: e.target.value })) }} />
          </label>
        ))}
        <div className="modal-actions">
          <button type="submit" className="solid">Save</button>
          {saved && <span className="muted">Saved</span>}
        </div>
      </form>
    </>
  )
}
