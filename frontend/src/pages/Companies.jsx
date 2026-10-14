import { useState } from 'react'
import { ChevronRight, MapPin, Search } from 'lucide-react'
import { useJson } from '../lib/api.js'

const TERMS = ['No payment terms', 'Due on receipt', 'Net 15', 'Net 30', 'Net 60']

export function Companies({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/companies')
  if (focus.create === '1') return <NewCompany onOpen={onOpen} onSaved={reload} />
  const picked = (rows || []).find(row => String(row.id) === String(focus.company))
  if (picked) return <CompanyDetail company={picked} onOpen={onOpen} />
  if (!rows) return <p className="muted">Loading companies…</p>
  return (
    <>
      <div className="orders-top">
        <h1>Companies</h1>
        <button type="button" className="solid" onClick={() => onOpen('companies', { create: '1' })}>Add company</button>
      </div>
      {rows.length === 0 ? (
        <section className="panel">
          <h2>Sell to businesses</h2>
          <p>Create a company, add the location you ship to, and assign a main contact from your customers.</p>
          <button type="button" className="solid" onClick={() => onOpen('companies', { create: '1' })}>Add company</button>
        </section>
      ) : (
        <div className="sheet">
          <table>
            <thead><tr><th>Company</th><th>Main contact</th><th>Location</th><th>Market</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="clickable" onClick={() => onOpen('companies', { company: row.id })}>
                  <td><button type="button" className="text-link">{row.name}</button></td>
                  <td>{row.contact || '—'}</td>
                  <td>{[row.city, row.address].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{row.market}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function CompanyDetail({ company, onOpen }) {
  return (
    <div className="order-page company-page">
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('companies')}>Companies</button>
        <span>/</span> {company.name}
      </div>
      <h1>{company.name}</h1>
      <section className="detail-card">
        <p>Company ID · {company.external_id || 'None'}</p>
        <p>Main contact · {company.contact
          ? <button type="button" className="text-link" onClick={() => onOpen('customers', { customer: company.contact })}>{company.contact}</button>
          : 'None'}</p>
        <p>Location · {[company.address, company.city].filter(Boolean).join(', ') || 'No address'}{company.location_id ? ` · ${company.location_id}` : ''}</p>
        <p>Market · <button type="button" className="text-link" onClick={() => onOpen('markets')}>{company.market}</button></p>
        <p>Payment terms · {company.terms}</p>
        <p>Order submission · {company.submission === 'draft' ? 'Submit all orders as drafts for review' : 'Automatically submit orders'}</p>
        <p>Tax · {company.tax_id || 'No tax ID'} · {company.tax_settings}</p>
      </section>
    </div>
  )
}

function NewCompany({ onOpen, onSaved }) {
  const [customers] = useJson('/api/customers')
  const [markets] = useJson('/api/markets')
  const [name, setName] = useState('')
  const [externalId, setExternalId] = useState('')
  const [contact, setContact] = useState('')
  const [query, setQuery] = useState('')
  const [addressOpen, setAddressOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [locationId, setLocationId] = useState('')
  const [billingSame, setBillingSame] = useState(true)
  const [billingAddress, setBillingAddress] = useState('')
  const [market, setMarket] = useState('Kenya')
  const [terms, setTerms] = useState('No payment terms')
  const [oneTime, setOneTime] = useState(false)
  const [submission, setSubmission] = useState('auto')
  const [taxId, setTaxId] = useState('')
  const [taxSettings, setTaxSettings] = useState('Collect tax')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mark = updater => value => { setDirty(true); updater(value) }
  const matches = (customers || []).filter(person => query && person.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
  const activeMarkets = (markets || []).filter(row => row.status === 'active')
  const clearAddress = () => { setAddress(''); setCity(''); setBillingAddress(''); setAddressOpen(false); setDirty(true) }
  const save = () => {
    if (!name.trim()) { setError('Enter a company name.'); return }
    setBusy(true)
    fetch('/api/companies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, external_id: externalId, contact, address, city, location_id: locationId,
        billing_same: billingSame, billing_address: billingSame ? '' : billingAddress,
        market, terms, one_time_address: oneTime, submission, tax_id: taxId, tax_settings: taxSettings,
      }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save')
      const company = await response.json()
      onSaved()
      onOpen('companies', { company: company.id })
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <div className="order-page company-page">
      {dirty && (
        <div className="save-bar">
          <span>Unsaved changes</span>
          <button type="button" className="ghost" onClick={() => onOpen('companies')}>Discard</button>
          <button type="button" className="solid" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('companies')}>Companies</button>
        <span>/</span> New company
      </div>
      <h1>New company</h1>
      {error && <p className="form-error">{error}</p>}
      <section className="detail-card">
        <label className="field">Company name
          <input value={name} onChange={e => mark(setName)(e.target.value)} />
          <span className="hint">This will appear in customer accounts and at checkout.</span>
        </label>
        <label className="field">Company ID
          <input value={externalId} onChange={e => mark(setExternalId)(e.target.value)} />
          <span className="hint">Add an existing external ID or create a unique ID.</span>
        </label>
      </section>
      <h2>Main contact</h2>
      <section className="detail-card">
        <label className="finder field-search"><Search size={15} />
          <input placeholder="Search" value={contact || query} onChange={e => { setContact(''); mark(setQuery)(e.target.value) }} />
        </label>
        {matches.length > 0 && (
          <div className="match-list">
            {matches.map(person => (
              <button type="button" key={person.id} onClick={() => { mark(setContact)(person.name); setQuery('') }}>{person.name}</button>
            ))}
          </div>
        )}
      </section>
      <h2>Location</h2>
      <p className="hint">Add a location to this company. This is where you'll ship products to. Each location can have custom catalogs, checkout settings, and more. You can add more locations later.</p>
      <section className="detail-card">
        <div className="section-head">
          <strong>Shipping address</strong>
          <button type="button" className="text-link" onClick={clearAddress}>Clear</button>
        </div>
        {addressOpen ? (
          <>
            <label className="field">Address
              <input value={address} onChange={e => mark(setAddress)(e.target.value)} />
            </label>
            <label className="field">City
              <input value={city} onChange={e => mark(setCity)(e.target.value)} />
            </label>
          </>
        ) : (
          <button type="button" className="addr-btn" onClick={() => setAddressOpen(true)}>
            <span><MapPin size={15} /> Add address</span>
            <ChevronRight size={16} />
          </button>
        )}
        <label className="check-row">
          <input type="checkbox" checked={billingSame} onChange={e => mark(setBillingSame)(e.target.checked)} />
          Billing address same as shipping address
        </label>
        {!billingSame && (
          <label className="field">Billing address
            <input value={billingAddress} onChange={e => mark(setBillingAddress)(e.target.value)} />
          </label>
        )}
        <label className="field">Location ID
          <input value={locationId} onChange={e => mark(setLocationId)(e.target.value)} />
          <span className="hint">Add an existing external ID or create a unique ID.</span>
        </label>
      </section>
      <h2>Markets</h2>
      <section className="detail-card market-row">
        {(activeMarkets.length ? activeMarkets : [{ name: 'Kenya' }]).map(row => (
          <button type="button" key={row.name} className={`market-chip ${market === row.name ? 'on' : ''}`} onClick={() => mark(setMarket)(row.name)}>{row.name}</button>
        ))}
      </section>
      <h2>Catalogs</h2>
      <section className="detail-card">
        <p className="catalog-note">No catalogs available. <button type="button" className="text-link" onClick={() => onOpen('markets')}>Go to Markets</button> to add market catalogs.</p>
      </section>
      <h2>Payment terms</h2>
      <section className="detail-card">
        <select aria-label="Payment terms" value={terms} onChange={e => mark(setTerms)(e.target.value)}>
          {TERMS.map(option => <option key={option}>{option}</option>)}
        </select>
      </section>
      <h2>Checkout</h2>
      <section className="detail-card">
        <strong>Ship to address</strong>
        <label className="check-row">
          <input type="checkbox" checked={oneTime} onChange={e => mark(setOneTime)(e.target.checked)} />
          Allow customers to ship to any one-time address
        </label>
        <strong>Order submission</strong>
        <label className="radio-row">
          <input type="radio" name="submission" checked={submission === 'auto'} onChange={() => mark(setSubmission)('auto')} />
          <span>Automatically submit orders<small>Orders without shipping addresses will be submitted as draft orders</small></span>
        </label>
        <label className="radio-row">
          <input type="radio" name="submission" checked={submission === 'draft'} onChange={() => mark(setSubmission)('draft')} />
          <span>Submit all orders as drafts for review</span>
        </label>
      </section>
      <h2>Tax details</h2>
      <section className="detail-card">
        <label className="field">Tax ID
          <input value={taxId} onChange={e => mark(setTaxId)(e.target.value)} />
        </label>
        <label className="field">Tax settings
          <select value={taxSettings} onChange={e => mark(setTaxSettings)(e.target.value)}>
            <option>Collect tax</option>
            <option>Don't collect tax</option>
          </select>
        </label>
      </section>
    </div>
  )
}
