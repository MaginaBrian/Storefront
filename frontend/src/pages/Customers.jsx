import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Pencil, Plus, Search } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { Tag } from '../components/Tag.jsx'
import { useApi, useJson } from '../lib/api.js'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'

function activityLabel(iso) {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function place(location) {
  if (!location) return '—'
  return location.includes(',') ? location : `${location}, Kenya`
}

function segmentMatch(text, customer) {
  const q = text.trim().toLowerCase()
  if (!q) return true
  if (q.includes("haven't") || q.includes('never')) return customer.orders === 0
  if (q.includes('more than once') || q.includes('repeat')) return customer.orders > 1
  if (q.includes('purchased') || q.includes('at least once')) return customer.orders >= 1
  if (q.includes('not subscribed')) return !customer.subscribed
  if (q.includes('subscrib')) return Boolean(customer.subscribed)
  return [customer.name, customer.email, customer.location].join(' ').toLowerCase().includes(q)
}

function ExportCustomers({ rows, shown, onClose }) {
  const [scope, setScope] = useState('all')
  const [tags, setTags] = useState(true)
  const [metafields, setMetafields] = useState(true)
  const [kind, setKind] = useState('excel')
  const chosen = scope === 'page' ? shown : rows
  const download = () => {
    const headers = ['Customer name', 'Email', 'Email subscription', 'Location', 'Orders', 'Amount spent']
    if (tags) headers.push('Tags')
    if (metafields) headers.push('Phone', 'Language', 'Tax settings')
    csv([
      headers,
      ...chosen.map(row => {
        const cells = [row.name, row.email, row.subscribed ? 'Subscribed' : 'Not subscribed', place(row.location), row.orders, money(row.spent)]
        if (tags) cells.push(row.tags || '')
        if (metafields) cells.push(row.phone || '', row.language || 'English', row.tax_settings || 'Collect tax')
        return cells
      }),
    ], 'customers.csv', { excel: kind === 'excel' })
    onClose()
  }
  return (
    <Modal title="Export customers" onClose={onClose}>
      <div className="export-body">
        <fieldset>
          <legend>Customers selected</legend>
          <label className="choice"><input type="radio" name="scope" checked={scope === 'page'} onChange={() => setScope('page')} />Current page</label>
          <label className="choice"><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />All customers</label>
        </fieldset>
        <fieldset>
          <legend>Fields included</legend>
          <p className="muted">By default, all exports include: full name, ID, address, email, phone number, company, marketing consent, orders, tax exempts.</p>
          <label className="choice"><input type="checkbox" checked={tags} onChange={e => setTags(e.target.checked)} />Customer tags</label>
          <label className="choice"><input type="checkbox" checked={metafields} onChange={e => setMetafields(e.target.checked)} />Customer metafields</label>
        </fieldset>
        <fieldset>
          <legend>File format</legend>
          <label className="choice"><input type="radio" name="kind" checked={kind === 'excel'} onChange={() => setKind('excel')} />CSV for Excel, Numbers, or other spreadsheet programs</label>
          <label className="choice"><input type="radio" name="kind" checked={kind === 'plain'} onChange={() => setKind('plain')} />Plain CSV file</label>
        </fieldset>
      </div>
      <div className="modal-actions">
        <a className="text-link" href="https://help.shopify.com/en/manual/customers" target="_blank" rel="noreferrer">Learn more</a>
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="solid" disabled={!chosen.length} onClick={download}>Export customers</button>
      </div>
    </Modal>
  )
}

function parseCustomers(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const keys = lines[0].split(',').map(cell => cell.replaceAll('"', '').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cells = line.split(',').map(cell => cell.replaceAll('"', '').trim())
    const row = Object.fromEntries(keys.map((key, index) => [key, cells[index] || '']))
    const subscription = row['email subscription'] || row.subscribed || ''
    return {
      first_name: row['first name'] || '',
      last_name: row['last name'] || '',
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      location: row.location || row.city || 'Nairobi',
      email_marketing: /yes|subscribed|true|1/i.test(subscription),
    }
  }).filter(row => row.name || row.first_name || row.last_name)
}

function ImportCustomers({ onClose, onImported }) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const read = file => {
    if (!file) return
    setFileName(file.name)
    file.text().then(text => {
      const parsed = parseCustomers(text)
      setRows(parsed)
      setError(parsed.length ? '' : 'That file has no customer rows.')
    })
  }
  const sample = () => csv([
    ['First name', 'Last name', 'Email', 'Phone', 'Location', 'Email subscription'],
    ['Amina', 'Hassan', 'amina@example.com', '+254700000000', 'Nairobi', 'Subscribed'],
  ], 'customers-sample.csv')
  const save = () => {
    setBusy(true)
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customers: rows }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not import customers')
      onImported()
      onClose()
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <Modal title="Import customers by CSV" onClose={onClose}>
      <div className="export-body">
        <label className="drop-actions csv-drop">
          <input type="file" accept=".csv,text/csv" hidden onChange={e => read(e.target.files?.[0])} />
          <span className="ghost">Add files</span>
          <small>{fileName || 'Accepts .csv'}</small>
        </label>
        {rows.length > 0 && <p>{rows.length} customers ready to import.</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="modal-actions">
        <button type="button" className="text-link" onClick={sample}>Download a sample CSV</button>
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="solid" disabled={!rows.length || busy} onClick={save}>{busy ? 'Importing…' : 'Import customers'}</button>
      </div>
    </Modal>
  )
}

function NewCustomer({ onOpen, onSaved }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [language, setLanguage] = useState('English')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailMarketing, setEmailMarketing] = useState(false)
  const [sms, setSms] = useState(false)
  const [whatsapp, setWhatsapp] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tags, setTags] = useState('')
  const [addressOpen, setAddressOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Nairobi')
  const [tax, setTax] = useState('Collect tax')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = event => {
    event.preventDefault()
    if (!first.trim() && !last.trim()) { setError('Enter a first or last name.'); return }
    setBusy(true)
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: first.trim(),
        last_name: last.trim(),
        email,
        phone,
        language,
        email_marketing: emailMarketing,
        sms,
        whatsapp,
        note,
        tags,
        location: city,
        address,
        tax_settings: tax,
      }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not add this customer')
      onSaved()
      onOpen('customers', { customer: body.name })
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <form className="order-page" onSubmit={save}>
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('customers')}>Customers</button>
        <span>/</span><span>New customer</span>
      </div>
      <div className="product-head">
        <h1>New customer</h1>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid">
        <div>
          <h2 className="section-label">Customer overview</h2>
          <section className="detail-card">
            <div className="name-row">
              <label className="field">First name<input value={first} onChange={e => setFirst(e.target.value)} /></label>
              <label className="field">Last name<input value={last} onChange={e => setLast(e.target.value)} /></label>
            </div>
            <label className="field">Language
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                <option>English</option>
                <option>Swahili</option>
              </select>
              <small className="muted">This customer will receive notifications in this language.</small>
            </label>
            <label className="field">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label className="field">Phone number
              <span className="phone-input"><b aria-hidden="true">🇰🇪</b><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254" /></span>
            </label>
            <label className="choice"><input type="checkbox" checked={emailMarketing} onChange={e => setEmailMarketing(e.target.checked)} />Customer agreed to receive marketing emails.</label>
            <label className="choice"><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} />Customer agreed to receive SMS marketing text messages.</label>
            <label className="choice"><input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} />Customer agreed to receive WhatsApp marketing messages.</label>
            <p className="muted">You should ask your customers for permission before you subscribe them to your marketing emails, SMS, or WhatsApp messages.</p>
          </section>
          <h2 className="section-label">Default address</h2>
          <p className="muted">The primary address of this customer</p>
          <section className="detail-card">
            {!addressOpen && <button type="button" className="ghost" onClick={() => setAddressOpen(true)}><Plus size={14} /> Add address</button>}
            {addressOpen && (
              <>
                <label className="field">Address<input value={address} onChange={e => setAddress(e.target.value)} /></label>
                <label className="field">City<input value={city} onChange={e => setCity(e.target.value)} /></label>
              </>
            )}
          </section>
          <h2 className="section-label">Tax details</h2>
          <section className="detail-card">
            <label className="field">Tax settings
              <select value={tax} onChange={e => setTax(e.target.value)}>
                <option>Collect tax</option>
                <option>Don't collect tax</option>
              </select>
            </label>
          </section>
        </div>
        <aside className="order-side">
          <section className="detail-card side-head">
            <div>
              <h2>Notes</h2>
              <p className="muted">Notes are private and won't be shared with the customer.</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Add note" onClick={() => setNoteOpen(open => !open)}><Pencil size={14} /></button>
          </section>
          {noteOpen && <section className="detail-card"><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note" /></section>}
          <section className="detail-card">
            <h2>Tags</h2>
            {!tagsOpen && <button type="button" className="ghost" onClick={() => setTagsOpen(true)}><Plus size={14} /> Add tags</button>}
            {tagsOpen && <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Wholesale, VIP" />}
          </section>
        </aside>
      </div>
    </form>
  )
}

export function Customers({ focus = {}, onOpen }) {
  const [rows, reload] = useApi('/api/customers')
  const [segments] = useJson('/api/segments')
  const [profile, setProfile] = useState(null)
  const [segment, setSegment] = useState(null)
  const [segmentRows, setSegmentRows] = useState(null)
  const [describe, setDescribe] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(() => new Set())
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  useEffect(() => {
    if (!focus.customer) { setProfile(null); return }
    let ignore = false
    setProfile(null)
    fetch(`/api/profile?customer=${encodeURIComponent(focus.customer)}`).then(r => r.json()).then(data => {
      if (!ignore) setProfile(data)
    })
    return () => { ignore = true }
  }, [focus.customer])
  useEffect(() => {
    if (!focus.segment) { setSegment(null); setSegmentRows(null); return }
    let ignore = false
    fetch(`/api/segments/${focus.segment}`).then(r => r.json()).then(data => {
      if (ignore) return
      setSegment(data.segment || null)
      setSegmentRows(data.customers || [])
    })
    return () => { ignore = true }
  }, [focus.segment])

  const source = focus.segment ? segmentRows : rows
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (source || []).filter(row => segmentMatch(describe, row) && (!q || [row.name, row.email, row.location].join(' ').toLowerCase().includes(q)))
  }, [source, describe, query])
  const described = (segments || []).filter(row => describe.trim() && row.name.toLowerCase().includes(describe.trim().toLowerCase())).slice(0, 4)
  const person = profile?.customer
  const detail = !profile
    ? 'Loading profile…'
    : person
      ? `${person.email || 'No email'} · ${place(person.location)} · ${person.orders} orders · ${money(person.spent)} spent`
      : 'No saved profile for this name yet.'

  if (focus.create === '1') return <NewCustomer onOpen={onOpen} onSaved={reload} />

  return (
    <>
      <div className="orders-top">
        <h1>Customers</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setExporting(true)}>Export</button>
          <button type="button" className="ghost" onClick={() => setImporting(true)}>Import</button>
          <button type="button" className="solid" onClick={() => onOpen('customers', { create: '1' })}>Add customer</button>
        </div>
      </div>
      {segment && (
        <section className="handoff">
          <div>
            <h2>{segment.name}</h2>
            <p>{segment.percent}% of customers · Created on {activityLabel(segment.last_activity)} · {segment.created_by}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('segments')}>All segments</button>
        </section>
      )}
      {focus.customer && (
        <section className="handoff">
          <div>
            <h2>{focus.customer}</h2>
            <p>{detail}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('orders', { customer: focus.customer })}>View orders</button>
        </section>
      )}
      {profile?.orders?.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Orders</h3>
          <table>
            <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Fulfillment</th></tr></thead>
            <tbody>
              {profile.orders.map(order => (
                <tr key={order.id}>
                  <td><button type="button" className="text-link" onClick={() => onOpen('orders', { order: order.id })}>#{order.id}</button></td>
                  <td>{order.created_at.slice(0, 10)}</td>
                  <td>{money(order.total)}</td>
                  <td>{order.payment}</td>
                  <td>{order.fulfillment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {profile?.drafts?.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Drafts</h3>
          <table>
            <thead><tr><th>Draft</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {profile.drafts.map(draft => (
                <tr key={draft.id}>
                  <td><button type="button" className="text-link" onClick={() => onOpen('drafts', { draft: draft.id })}>#{draft.id}</button></td>
                  <td>{draft.created_at.slice(0, 10)}</td>
                  <td>{money(draft.total)}</td>
                  <td>{draft.status}{draft.order_id ? ` · order #${draft.order_id}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <label className="segment-query">
        <input placeholder="Describe your segment" value={describe} onChange={e => setDescribe(e.target.value)} />
        <ChevronDown size={16} />
      </label>
      {described.length > 0 && (
        <div className="picker segment-hits">
          {described.map(row => (
            <button type="button" key={row.id} onClick={() => onOpen('customers', { segment: row.id })}>{row.name}</button>
          ))}
        </div>
      )}
      <div className="sheet">
        <div className="toolbar">
          <label className="finder"><Search size={15} /><input placeholder="Search customers" value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check"><input type="checkbox" aria-label="Select customers" checked={shown.length > 0 && shown.every(row => picked.has(row.id))} onChange={e => setPicked(e.target.checked ? new Set(shown.map(row => row.id)) : new Set())} /></th>
                <th>Customer name</th>
                <th>Email subscription</th>
                <th>Location</th>
                <th>Orders</th>
                <th>Amount spent</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(row => (
                <tr key={row.id} className={row.name === focus.customer ? 'picked' : ''}>
                  <td className="check"><input type="checkbox" aria-label={`Select ${row.name}`} checked={picked.has(row.id)} onChange={() => setPicked(current => {
                    const next = new Set(current)
                    next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                    return next
                  })} /></td>
                  <td><button type="button" className="text-link" onClick={() => onOpen('customers', { customer: row.name })}>{row.name}</button></td>
                  <td>{row.subscribed ? '' : <Tag kind="quiet">Not subscribed</Tag>}</td>
                  <td>{place(row.location)}</td>
                  <td>{row.orders}</td>
                  <td>{money(row.spent)}</td>
                </tr>
              ))}
              {source && shown.length === 0 && <tr><td className="muted" colSpan={6}>{focus.segment ? 'No customers in this segment.' : 'No customers match this search.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <a className="learn" href="https://help.shopify.com/en/manual/customers" target="_blank" rel="noreferrer">Learn more about customers</a>
      {exporting && <ExportCustomers rows={source || []} shown={shown} onClose={() => setExporting(false)} />}
      {importing && <ImportCustomers onClose={() => setImporting(false)} onImported={reload} />}
    </>
  )
}
