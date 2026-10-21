import { useEffect, useState } from 'react'
import { ChevronRight, Ellipsis, MapPin, Search, Store } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { money } from '../lib/money.js'

const SECTIONS = [
  ['general', 'General'],
  ['payments', 'Payments'],
  ['checkout', 'Checkout'],
  ['shipping', 'Shipping and delivery'],
  ['taxes', 'Taxes and duties'],
  ['locations', 'Locations'],
  ['channels', 'Sales channels'],
  ['domains', 'Domains'],
  ['notifications', 'Notifications'],
  ['content', 'Content'],
]

const FULFILL = [
  ['all', 'Mark paid orders fulfilled'],
  ['gift', 'Fulfill gift cards only'],
  ['none', 'Leave paid orders unfulfilled until you fulfill them'],
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
  const name = valueOf(rows, 'entity_name', 'Maison')
  return (
    <div className="settings-layout">
      <aside className="settings-rail">
        <div className="settings-store">
          <b>MA</b>
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
        ? <General rows={rows} store={store} onOpen={onOpen} onSaved={reload} />
        : <Section id={section} rows={rows} store={store} onOpen={onOpen} />}
    </div>
  )
}

function General({ rows, store, onOpen, onSaved }) {
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
  const email = read('contact_email', 'hello@maison.co.ke')
  const phone = read('phone')
  const address = read('address', 'Nairobi, Nairobi, 00100, Kenya')
  const name = read('entity_name', 'Maison')
  const sample = [1001, 1002, 1004].map(id => `${prefix}${id}${suffix}`).join(', ')
  return (
    <div className="settings-page">
      <h1>General</h1>
      {notice && <p className="form-error">{notice}</p>}
      <section className="settings-block">
        <h2>Store</h2>
        <p className="lead">Maison sells from Nairobi. Kenya is the home market, and prices are in Kenyan shillings.</p>
        <div className="detail-card settings-entity">
          <span className="flag" aria-hidden="true">🇰🇪</span>
          <span className="grow"><strong>{name}</strong><small>{read('entity_country', 'Kenya')} · {store?.theme || 'Dawn'} theme</small></span>
          <div className="menu-wrap">
            <button type="button" className="icon-btn" aria-label="Store actions" onClick={() => setEntityMenu(value => !value)}><Ellipsis size={16} /></button>
            {entityMenu && (
              <div className="popover menu-pop">
                <button type="button" onClick={() => { setEntityMenu(false); setEditing('entity') }}>Edit store name</button>
                <button type="button" onClick={() => { setEntityMenu(false); onOpen('store') }}>Online Store</button>
                <button type="button" onClick={() => { setEntityMenu(false); onOpen('markets', { market: 'Kenya' }) }}>Kenya market</button>
              </div>
            )}
          </div>
        </div>
        {editing === 'entity' && (
          <Editor
            title="Store name"
            fields={[['entity_name', 'Name', name]]}
            onClose={() => setEditing('')}
            onSave={patch => { save(patch); setEditing('') }}
          />
        )}
      </section>

      <section className="settings-block">
        <h2>Contact</h2>
        <div className="settings-rows">
          <button type="button" className="settings-row" onClick={() => setEditing('contact')}>
            <Store size={16} />
            <span className="grow"><strong>Maison Admin</strong><small>{email} · {phone || 'No phone number'}</small></span>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="settings-row" onClick={() => setEditing('address')}>
            <MapPin size={16} />
            <span className="grow"><strong>Nairobi location</strong><small>{address}</small></span>
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
            title="Nairobi location"
            fields={[['address', 'Address', address]]}
            onClose={() => setEditing('')}
            onSave={patch => { save(patch); setEditing('') }}
          />
        )}
      </section>

      <section className="settings-block">
        <h2>Defaults</h2>
        <div className="detail-card defaults-card">
          <div className="settings-inline">
            <span className="grow">
              <strong>Currency</strong>
              <small>Kenya uses KES. Uganda and Tanzania keep their own currencies in <button type="button" className="text-link" onClick={() => onOpen('markets')}>Markets</button>.</small>
            </span>
            <span>{read('currency_label', 'Kenyan Shilling (KES)')}</span>
            <div className="menu-wrap">
              <button type="button" className="icon-btn" aria-label="Currency actions" onClick={() => setCurrencyMenu(value => !value)}><Ellipsis size={16} /></button>
              {currencyMenu && (
                <div className="popover menu-pop">
                  <button type="button" onClick={() => { setCurrencyMenu(false); onOpen('markets') }}>Open Markets</button>
                </div>
              )}
            </div>
          </div>
          <div className="settings-inline">
            <span className="grow"><strong>Time zone</strong><small>Order times and the analytics day use this zone.</small></span>
            <span>{read('timezone', 'Africa/Nairobi')}</span>
          </div>
          <div className="settings-inline">
            <span className="grow"><strong>Home market</strong></span>
            <span>{read('backup_region', 'Kenya')}</span>
          </div>
        </div>
      </section>

      <section className="settings-block">
        <h2>Order numbers</h2>
        <p className="lead">Shown on orders, drafts, and customer pages. Current orders are {sample}.</p>
        <div className="detail-card">
          <div className="order-id-fields">
            <label className="field">Prefix
              <input value={prefix} maxLength={8} onChange={e => setPrefix(e.target.value)} onBlur={() => prefix !== read('order_prefix', '#') && save({ order_prefix: prefix })} />
            </label>
            <label className="field">Suffix
              <input value={suffix} maxLength={8} onChange={e => setSuffix(e.target.value)} onBlur={() => suffix !== read('order_suffix', '') && save({ order_suffix: suffix })} />
            </label>
          </div>
        </div>
      </section>

      <section className="settings-block">
        <h2>After payment</h2>
        <div className="detail-card">
          <p className="lead">Draft orders stay in Orders until you fulfill them. Gift cards are created from Products.</p>
          {FULFILL.map(([id, label]) => (
            <label className="choice" key={id}>
              <input type="radio" name="fulfill" checked={read('fulfill_mode', 'none') === id} onChange={() => save({ fulfill_mode: id })} />
              {label}
            </label>
          ))}
          <label className="choice archive-lead">
            <input type="checkbox" checked={read('auto_archive', '1') === '1'} onChange={e => save({ auto_archive: e.target.checked ? '1' : '0' })} />
            <span>Hide fulfilled orders from the open list<small>Paid and fulfilled orders leave the open orders count.</small></span>
          </label>
          <div className="orders-actions">
            <button type="button" className="ghost" onClick={() => onOpen('orders')}>Orders</button>
            <button type="button" className="ghost" onClick={() => onOpen('gift-cards')}>Gift cards</button>
          </div>
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
  const pages = {
    payments: <Payments onOpen={onOpen} />,
    checkout: <Checkout rows={rows} onOpen={onOpen} />,
    shipping: <Shipping rows={rows} onOpen={onOpen} />,
    taxes: <Taxes onOpen={onOpen} />,
    locations: <Locations rows={rows} onOpen={onOpen} />,
    channels: <Channels onOpen={onOpen} />,
    domains: <Domains store={store} onOpen={onOpen} />,
    notifications: <Notifications onOpen={onOpen} />,
    content: <ContentLinks onOpen={onOpen} />,
  }
  return (
    <div className="settings-page">
      <h1>{title}</h1>
      {pages[id]}
    </div>
  )
}

function Payments({ onOpen }) {
  const [orders] = useJson('/api/orders')
  const rows = orders || []
  return (
    <section className="settings-block">
      <p className="lead">Payment state comes from each order. Pending orders stay open until they are paid.</p>
      <div className="settings-rows">
        {rows.map(order => (
          <button type="button" className="settings-row" key={order.id} onClick={() => onOpen('orders', { order: order.id })}>
            <span className="grow"><strong>#{order.id} · {order.customer}</strong><small>{order.payment} · {order.fulfillment}</small></span>
            <span>{money(order.total)}</span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </section>
  )
}

function Checkout({ rows, onOpen }) {
  const mode = valueOf(rows, 'fulfill_mode', 'none')
  const label = FULFILL.find(([id]) => id === mode)?.[1] || FULFILL[2][1]
  return (
    <section className="settings-block">
      <p className="lead">Checkout creates a draft, then an order. {label}.</p>
      <div className="settings-rows">
        <button type="button" className="settings-row" onClick={() => onOpen('drafts')}><span className="grow"><strong>Drafts</strong><small>Orders that have not been completed</small></span><ChevronRight size={16} /></button>
        <button type="button" className="settings-row" onClick={() => onOpen('checkouts')}><span className="grow"><strong>Abandoned checkouts</strong><small>Customers who left before paying</small></span><ChevronRight size={16} /></button>
        <button type="button" className="settings-row" onClick={() => onOpen('gift-cards')}><span className="grow"><strong>Gift cards</strong><small>Issued from Products and fulfilled on their own</small></span><ChevronRight size={16} /></button>
        <button type="button" className="settings-row" onClick={() => onOpen('discounts')}><span className="grow"><strong>Discounts</strong><small>WELCOME10, FREESHIP, and WEEKEND</small></span><ChevronRight size={16} /></button>
      </div>
    </section>
  )
}

function Shipping({ rows, onOpen }) {
  const address = valueOf(rows, 'address', 'Nairobi, Nairobi, 00100, Kenya')
  const [markets] = useJson('/api/markets')
  return (
    <section className="settings-block">
      <p className="lead">Orders ship from {address}. Each market has one shipping rate.</p>
      <div className="settings-rows">
        {(markets || []).map(market => (
          <button type="button" className="settings-row" key={market.id} onClick={() => onOpen('markets', { market: market.name })}>
            <span className="grow"><strong>Shipping to {market.name}</strong><small>1 rate · {market.currency} · {market.status}</small></span>
            <ChevronRight size={16} />
          </button>
        ))}
        <button type="button" className="settings-row" onClick={() => onOpen('inventory')}>
          <span className="grow"><strong>Stock at Nairobi</strong><small>Fabric and product quantities available to ship</small></span>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

function Taxes({ onOpen }) {
  return (
    <section className="settings-block">
      <p className="lead">Kenya prices include 16% VAT. The tax line on an order is the included amount, not an extra charge.</p>
      <div className="settings-rows">
        <button type="button" className="settings-row" onClick={() => onOpen('orders', { order: 1004 })}>
          <span className="grow"><strong>VAT on order #1004</strong><small>Korom Festival · included in the total</small></span>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="settings-row" onClick={() => onOpen('markets', { market: 'Kenya' })}>
          <span className="grow"><strong>Kenya market</strong><small>Collecting sales tax</small></span>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

function Locations({ rows, onOpen }) {
  return (
    <section className="settings-block">
      <p className="lead">Maison has one location. Inventory, shipping, and the store address all use it.</p>
      <div className="settings-rows">
        <button type="button" className="settings-row" onClick={() => onOpen('inventory')}>
          <span className="grow"><strong>Nairobi</strong><small>{valueOf(rows, 'address', 'Nairobi, Nairobi, 00100, Kenya')}</small></span>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

function Channels({ onOpen }) {
  const [dash] = useJson('/api/dashboard')
  return (
    <section className="settings-block">
      <p className="lead">The home chart uses these channels. Open a channel to see its orders.</p>
      <div className="settings-rows">
        {(dash?.channels || []).map(channel => (
          <button type="button" className="settings-row" key={channel.name} onClick={() => onOpen(channel.view || 'orders', channel.view === 'orders' ? { channel: channel.name } : undefined)}>
            <span className="grow"><strong>{channel.name}</strong><small>{channel.orders.toLocaleString()} orders · KES {channel.sales.toLocaleString()}</small></span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </section>
  )
}

function Domains({ store, onOpen }) {
  return (
    <section className="settings-block">
      <p className="lead">The published storefront is {store?.domain || 'maison.co.ke'} on the {store?.theme || 'Dawn'} theme.</p>
      <div className="settings-rows">
        <button type="button" className="settings-row" onClick={() => onOpen('store')}>
          <span className="grow"><strong>{store?.domain || 'maison.co.ke'}</strong><small>{store?.status || 'Published'} · {store?.theme || 'Dawn'}</small></span>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="settings-row" onClick={() => onOpen('markets', { market: 'Kenya' })}>
          <span className="grow"><strong>Language</strong><small>English on the Kenya market</small></span>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

function Notifications({ onOpen }) {
  const [summary] = useJson('/api/orders/summary')
  return (
    <section className="settings-block">
      <p className="lead">Maison Admin sees the same alerts as the home page: open orders and low stock.</p>
      <div className="settings-rows">
        <button type="button" className="settings-row" onClick={() => onOpen('orders')}>
          <span className="grow"><strong>Open orders</strong><small>{summary?.unfulfilled ?? 0} unfulfilled</small></span>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="settings-row" onClick={() => onOpen('products', { stock: 'low' })}>
          <span className="grow"><strong>Low stock</strong><small>Products with 14 or fewer left</small></span>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="settings-row" onClick={() => onOpen('campaigns')}>
          <span className="grow"><strong>Campaigns</strong><small>Track which channels bring sessions and sales</small></span>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

function ContentLinks({ onOpen }) {
  const links = [
    ['content', 'Pages', 'Home, About, and Contact'],
    ['menus', 'Menus', 'Main menu, footer, and customer account'],
    ['metaobjects', 'Colors', 'Swatches used on products'],
    ['files', 'Files', 'Images uploaded for the storefront'],
    ['blog-posts', 'Blog posts', 'News posts on the storefront'],
    ['catalogs', 'Catalogs', 'Prices shown to a market'],
  ]
  return (
    <section className="settings-block">
      <p className="lead">Piacì content for maison.co.ke. Pages and menus are what customers see. Catalogs change prices by market.</p>
      <div className="settings-rows">
        {links.map(([view, label, detail]) => (
          <button type="button" className="settings-row" key={view} onClick={() => onOpen(view)}>
            <span className="grow"><strong>{label}</strong><small>{detail}</small></span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </section>
  )
}
