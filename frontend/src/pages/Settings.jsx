import { useEffect, useState } from 'react'
import { ChevronRight, Ellipsis, MapPin, Search, Store } from 'lucide-react'
import { useJson } from '../lib/api.js'

const SECTIONS = [
  ['general', 'General'],
  ['plan', 'Plan'],
  ['billing', 'Billing'],
  ['users', 'Users'],
  ['payments', 'Payments'],
  ['checkout', 'Checkout'],
  ['accounts', 'Customer accounts'],
  ['shipping', 'Shipping and delivery'],
  ['taxes', 'Taxes and duties'],
  ['locations', 'Locations'],
  ['apps', 'Apps'],
  ['channels', 'Sales channels'],
  ['domains', 'Domains'],
  ['events', 'Customer events'],
  ['notifications', 'Notifications'],
  ['metafields', 'Metafields and metaobjects'],
]

const FULFILL = [
  ['all', "Automatically fulfill the order's line items"],
  ['gift', 'Automatically fulfill only the gift cards of the order'],
  ['none', "Don't fulfill any of the order's line items automatically"],
]

function valueOf(rows, key, fallback = '') {
  return rows?.find(row => row.key === key)?.value ?? fallback
}

export function Settings({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/settings')
  const [store] = useJson('/api/store')
  const [query, setQuery] = useState('')
  const section = SECTIONS.some(([id]) => id === focus.section) ? focus.section : 'general'
  const shown = SECTIONS.filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()))
  const name = valueOf(rows, 'entity_name', 'My Store')
  return (
    <div className="settings-layout">
      <aside className="settings-rail">
        <div className="settings-store">
          <b>MS</b>
          <span>{name}<small>{store?.domain || 'maison.co.ke'}</small></span>
        </div>
        <label className="search settings-search">
          <Search size={14} />
          <input aria-label="Search settings" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        {shown.map(([id, label]) => (
          <button type="button" key={id} className={section === id ? 'on' : ''} onClick={() => onOpen('settings', { section: id })}>{label}</button>
        ))}
      </aside>
      {section === 'general'
        ? <General rows={rows} onOpen={onOpen} onSaved={reload} />
        : <Section id={section} rows={rows} store={store} onOpen={onOpen} />}
    </div>
  )
}

function General({ rows, onOpen, onSaved }) {
  const [entityMenu, setEntityMenu] = useState(false)
  const [currencyMenu, setCurrencyMenu] = useState(false)
  const [editing, setEditing] = useState('')
  const [notice, setNotice] = useState('')
  const [prefix, setPrefix] = useState('#')
  const [suffix, setSuffix] = useState('')
  const read = (key, fallback = '') => valueOf(rows, key, fallback)
  useEffect(() => {
    setPrefix(read('order_prefix', '#'))
    setSuffix(read('order_suffix', ''))
  }, [rows])
  const save = patch => {
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(response => {
      if (!response.ok) throw new Error()
      onSaved()
    }).catch(() => setNotice('Could not save that change.'))
  }
  const email = read('contact_email', 'cosinecreate@gmail.com')
  const phone = read('phone')
  const address = read('address', 'Nairobi, Nairobi, 00100, Kenya')
  const name = read('entity_name', 'My Store')
  const sample = [1, 2, 3].map(n => `${prefix}100${n}${suffix}`).join(', ')
  return (
    <div className="settings-page">
      <h1>General</h1>
      {notice && <p className="form-error">{notice}</p>}
      <section className="settings-block">
        <h2>Business details</h2>
        <p className="lead">Business entity used for financial products, markets, apps, and taxes in this shop</p>
        <div className="detail-card settings-entity">
          <span className="flag" aria-hidden="true">🇰🇪</span>
          <span className="grow"><strong>{name}</strong><small>{read('entity_country', 'Kenya')}</small></span>
          <div className="menu-wrap">
            <button type="button" className="icon-btn" aria-label="Business actions" onClick={() => setEntityMenu(value => !value)}><Ellipsis size={16} /></button>
            {entityMenu && (
              <div className="popover menu-pop">
                <button type="button" onClick={() => { setEntityMenu(false); setEditing('entity') }}>Edit business name</button>
                <button type="button" onClick={() => { setEntityMenu(false); onOpen('markets', { market: 'Kenya' }) }}>View Kenya market</button>
              </div>
            )}
          </div>
        </div>
        {editing === 'entity' && (
          <Editor
            title="Business name"
            fields={[['entity_name', 'Name', name]]}
            onClose={() => setEditing('')}
            onSave={patch => { save(patch); setEditing('') }}
          />
        )}
      </section>

      <section className="settings-block">
        <h2>Store contact details</h2>
        <div className="settings-rows">
          <button type="button" className="settings-row" onClick={() => setEditing('contact')}>
            <Store size={16} />
            <span className="grow"><strong>{name}</strong><small>{email} · {phone || 'No phone number'}</small></span>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="settings-row" onClick={() => setEditing('address')}>
            <MapPin size={16} />
            <span className="grow"><strong>Store address</strong><small>{address}</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
        {editing === 'contact' && (
          <Editor
            title="Store contact"
            fields={[['contact_email', 'Email', email], ['phone', 'Phone', phone]]}
            onClose={() => setEditing('')}
            onSave={patch => { save(patch); setEditing('') }}
          />
        )}
        {editing === 'address' && (
          <Editor
            title="Store address"
            fields={[['address', 'Address', address]]}
            onClose={() => setEditing('')}
            onSave={patch => { save(patch); setEditing('') }}
          />
        )}
      </section>

      <section className="settings-block">
        <h2>Store defaults</h2>
        <div className="detail-card defaults-card">
          <div className="settings-inline">
            <span className="grow">
              <strong>Currency display</strong>
              <small>To manage the currencies customers see, go to <button type="button" className="text-link" onClick={() => onOpen('markets')}>Markets</button></small>
            </span>
            <span>{read('currency_label', 'Kenyan Shilling (KES)')}</span>
            <div className="menu-wrap">
              <button type="button" className="icon-btn" aria-label="Currency actions" onClick={() => setCurrencyMenu(value => !value)}><Ellipsis size={16} /></button>
              {currencyMenu && (
                <div className="popover menu-pop">
                  <button type="button" onClick={() => { setCurrencyMenu(false); onOpen('markets') }}>Manage in Markets</button>
                </div>
              )}
            </div>
          </div>
          <div className="settings-inline">
            <span className="grow"><strong>Backup Region</strong></span>
            <span>{read('backup_region', 'Kenya')}</span>
          </div>
        </div>
      </section>

      <p className="settings-note">To change your user level time zone and language visit your account settings</p>

      <section className="settings-block">
        <h2>Order ID format</h2>
        <p className="lead">Shown on the order page, customer pages, and customer order notifications to identify order</p>
        <div className="detail-card">
          <div className="order-id-fields">
            <label className="field">Prefix
              <input value={prefix} maxLength={8} onChange={e => setPrefix(e.target.value)} onBlur={() => prefix !== read('order_prefix', '#') && save({ order_prefix: prefix })} />
            </label>
            <label className="field">Suffix
              <input value={suffix} maxLength={8} onChange={e => setSuffix(e.target.value)} onBlur={() => suffix !== read('order_suffix', '') && save({ order_suffix: suffix })} />
            </label>
          </div>
          <p className="lead">Your order ID will appear as {sample}, ...</p>
        </div>
      </section>

      <section className="settings-block">
        <h2>Order processing</h2>
        <div className="detail-card">
          <p className="lead">After an order has been paid</p>
          {FULFILL.map(([id, label]) => (
            <label className="choice" key={id}>
              <input type="radio" name="fulfill" checked={read('fulfill_mode', 'none') === id} onChange={() => save({ fulfill_mode: id })} />
              {label}
            </label>
          ))}
          <p className="lead archive-lead">After an order has been fulfilled and paid, or when all items have been refunded</p>
          <label className="choice">
            <input type="checkbox" checked={read('auto_archive', '1') === '1'} onChange={e => save({ auto_archive: e.target.checked ? '1' : '0' })} />
            <span>Automatically archive the order<small>The order will be removed from your list of open orders.</small></span>
          </label>
        </div>
      </section>

      <section className="settings-block">
        <h2>Store assets</h2>
        <div className="settings-rows">
          <button type="button" className="settings-row" onClick={() => onOpen('metaobjects')}>
            <span className="grow"><strong>Metafields</strong><small>Available in themes and configurable for Storefront API</small></span>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="settings-row" onClick={() => onOpen('store')}>
            <span className="grow"><strong>Brand</strong><small>Integrate brand assets across sales channels, themes and apps</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <section className="settings-block">
        <h2>Resources</h2>
        <div className="settings-rows">
          <button type="button" className="settings-row" onClick={() => setNotice('Change log: catalog products, Kenya market, and store contact were updated today.')}>
            <span className="grow"><strong>Change log</strong></span><ChevronRight size={16} />
          </button>
          <button type="button" className="settings-row" onClick={() => setNotice('Help Center covers orders, products, markets, and settings for this store.')}>
            <span className="grow"><strong>Help Center</strong></span><ChevronRight size={16} />
          </button>
          <button type="button" className="settings-row" onClick={() => setNotice('Partner directory is not connected for this store.')}>
            <span className="grow"><strong>Hire a partner</strong></span><ChevronRight size={16} />
          </button>
        </div>
        <div className="settings-rows">
          <button type="button" className="settings-row" onClick={() => setNotice('Press Ctrl K to search. Settings sections are in the list on the left.')}>
            <span className="grow"><strong>Keyboard shortcuts</strong></span><ChevronRight size={16} />
          </button>
          <button type="button" className="settings-row" onClick={() => setNotice('Store activity: Kenya market is active. No catalog has been saved.')}>
            <span className="grow"><strong>Store activity log</strong></span><ChevronRight size={16} />
          </button>
        </div>
      </section>

      <section className="settings-block">
        <h2>Transfer store</h2>
        <div className="detail-card transfer-card">
          <p>Move this store into an organization or transfer to an external owner.</p>
          <button type="button" className="ghost" onClick={() => setNotice('Store transfer stays in this store. Nothing was moved.')}>Manage</button>
        </div>
      </section>
    </div>
  )
}

function Editor({ title, fields, onClose, onSave }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(([key, , value]) => [key, value])))
  return (
    <form className="detail-card settings-editor" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <h2>{title}</h2>
      {fields.map(([key, label]) => (
        <label className="field" key={key}>{label}
          <input value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} />
        </label>
      ))}
      <div className="orders-actions">
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="solid">Save</button>
      </div>
    </form>
  )
}

function Section({ id, rows, store, onOpen }) {
  const title = SECTIONS.find(([key]) => key === id)?.[1] || 'Settings'
  const name = valueOf(rows, 'entity_name', 'My Store')
  const email = valueOf(rows, 'contact_email', 'cosinecreate@gmail.com')
  const address = valueOf(rows, 'address', 'Nairobi, Nairobi, 00100, Kenya')
  const body = {
    plan: <p>Basic plan for {name}. Markets, catalogs, and the online store are included.</p>,
    billing: <p>No invoices yet. Charges for this store will appear here.</p>,
    users: <p>Store owner · {email}. No other staff accounts.</p>,
    payments: <p>Payments are not set up. Orders can still be created as drafts.</p>,
    checkout: <p>Checkout follows the order processing rules in General. Gift cards stay in the products section.</p>,
    accounts: <p>Customers can check out without an account. Account menus are in Content.</p>,
    shipping: <p>1 rate · Shipping to Kenya. The Nairobi location is {address}.</p>,
    taxes: <p>Collecting sales tax. Kenya is the business country for this shop.</p>,
    locations: <p>Primary location · {address}</p>,
    apps: <p>No apps installed.</p>,
    channels: <p>Online Store is published on {store?.domain || 'maison.co.ke'} with the {store?.theme || 'Dawn'} theme.</p>,
    domains: <p>Primary domain · {store?.domain || 'maison.co.ke'}</p>,
    events: <p>No customer events are tracking on the storefront.</p>,
    notifications: <p>Customer order notifications use the order ID format from General.</p>,
    metafields: <p>Color metaobjects are available for products and the Storefront API.</p>,
  }[id]
  return (
    <div className="settings-page">
      <h1>{title}</h1>
      <section className="detail-card settings-section">
        {body}
        <div className="orders-actions">
          {id === 'channels' && <button type="button" className="ghost" onClick={() => onOpen('store')}>Online Store</button>}
          {id === 'domains' && <button type="button" className="ghost" onClick={() => onOpen('store')}>View domain</button>}
          {id === 'metafields' && <button type="button" className="ghost" onClick={() => onOpen('metaobjects')}>Metaobjects</button>}
          {id === 'accounts' && <button type="button" className="ghost" onClick={() => onOpen('menus')}>Menus</button>}
          {id === 'shipping' && <button type="button" className="ghost" onClick={() => onOpen('markets', { market: 'Kenya' })}>Kenya market</button>}
          {id === 'taxes' && <button type="button" className="ghost" onClick={() => onOpen('markets', { market: 'Kenya' })}>Kenya market</button>}
          <button type="button" className="ghost" onClick={() => onOpen('settings', { section: 'general' })}>General</button>
        </div>
      </section>
    </div>
  )
}
