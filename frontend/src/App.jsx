import { useEffect, useState } from 'react'
import { BarChart3, Globe, Inbox, Moon, Search, Sun, Tag, Users } from 'lucide-react'
import CatalogSection from './catalog/index.jsx'
import Home from './home/Home.jsx'
import { allowed, storedStaff, useStaff } from './access.js'
import { search as searchRecords } from './api/resources.js'
import { useApi, useJson } from './lib/api.js'
import { ANALYTICS_VIEWS, CHANNELS, CUSTOMER_VIEWS, MARKET_VIEWS, NAV, PRODUCT_VIEWS, SETTINGS, readRoute } from './nav.js'
import OrdersSection from './orders/index.jsx'
import { AgenticPage, Analytics, Attribution, Autopilot, BlogPosts, Campaigns, Catalogs, Companies, Content, Customers, Discounts, Files, LiveView, Markets, Menus, Metaobjects, Products, Reports, Rollouts, Segments, Settings as SettingsPage, StorePage } from './pages/index.js'

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const toggle = () => {
    const next = !dark
    if (next) document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    localStorage.setItem('storefront-theme', next ? 'dark' : 'light')
    setDark(next)
  }
  return (
    <button type="button" className="nav" onClick={toggle}>
      {dark ? <Sun size={17} strokeWidth={1.6} /> : <Moon size={17} strokeWidth={1.6} />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}

export default function App() {
  const initial = readRoute()
  const [view, setViewState] = useState(initial.view)
  const [focus, setFocus] = useState(initial.focus)
  const [session] = useJson('/api/session')
  const [who, setWho] = useState(false)
  const stored = storedStaff()
  const permissions = session?.permissions || (stored ? [] : null)
  const can = key => permissions == null || permissions.includes(key)
  const [summary, reloadSummary] = useApi(can('orders') ? '/api/orders/summary' : '')
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState([])
  useEffect(() => {
    if (session?.id && !storedStaff()) localStorage.setItem('storefront-staff', String(session.id))
  }, [session])
  useEffect(() => {
    const sync = () => {
      const route = readRoute()
      setViewState(route.view)
      setFocus(route.focus)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    const focus = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('nav-search')?.focus()
      }
    }
    window.addEventListener('keydown', focus)
    return () => window.removeEventListener('keydown', focus)
  }, [])
  useEffect(() => {
    if (search.trim().length < 2) { setHits([]); return }
    const handle = setTimeout(() => {
      searchRecords(search.trim()).then(setHits).catch(() => setHits([]))
    }, 150)
    return () => clearTimeout(handle)
  }, [search])
  const setView = (id, extra) => {
    const params = new URLSearchParams()
    if (extra && typeof extra === 'object') {
      for (const [key, value] of Object.entries(extra)) {
        if (value != null && value !== '') params.set(key, String(value))
      }
    }
    const next = `#/${id}${params.toString() ? `?${params}` : ''}`
    if (location.hash !== next) location.hash = next
    setViewState(id)
    setFocus({ ...Object.fromEntries(params), tick: Date.now() })
    setSearch('')
    setHits([])
  }
  const pages = [...NAV, ...CHANNELS, SETTINGS, { id: 'drafts', label: 'Drafts' }, { id: 'checkouts', label: 'Abandoned checkouts' }, { id: 'collections', label: 'Collections' }, { id: 'inventory', label: 'Inventory' }, { id: 'purchase-orders', label: 'Purchase orders' }, { id: 'transfers', label: 'Transfers' }, { id: 'gift-cards', label: 'Gift cards' }, { id: 'segments', label: 'Segments' }, { id: 'attribution', label: 'Attribution' }, { id: 'autopilot', label: 'Autopilot' }, { id: 'campaigns', label: 'Campaigns' }, { id: 'metaobjects', label: 'Metaobjects' }, { id: 'files', label: 'Files' }, { id: 'menus', label: 'Menus' }, { id: 'blog-posts', label: 'Blog posts' }, { id: 'catalogs', label: 'Catalogs' }, { id: 'rollouts', label: 'Rollouts' }, { id: 'reports', label: 'Reports' }, { id: 'live-view', label: 'Live View' }]
  const pageHits = search.trim().length < 2 ? [] : pages.filter(p => p.label.toLowerCase().includes(search.trim().toLowerCase()) && (permissions == null || allowed(p.id, permissions)))
  const viewOk = permissions == null || allowed(view, permissions)
  const visibleNav = NAV.filter(entry => can(entry.id))
  const visibleChannels = CHANNELS.filter(entry => can(entry.id === 'store' ? 'online_store' : 'agentic'))
  const item = ({ id, label, icon: Icon }) => (
    <button key={id} className={`nav ${view === id ? 'on' : ''}`} onClick={() => setView(id)}>
      <Icon size={17} strokeWidth={1.6} />{label}
    </button>
  )
  const ordersOpen = view === 'orders' || view === 'drafts' || view === 'checkouts'
  const productsOpen = view === 'products' || PRODUCT_VIEWS.includes(view)
  const customersOpen = view === 'customers' || CUSTOMER_VIEWS.includes(view)
  const marketsOpen = view === 'markets' || MARKET_VIEWS.includes(view)
  const analyticsOpen = view === 'analytics' || ANALYTICS_VIEWS.includes(view)
  return (
    <div className="shell">
      <aside>
        <button type="button" className="brand" onClick={() => setView('home')}>Piacì</button>
        <label className="search"><Search size={15} /><input id="nav-search" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /><kbd>Ctrl K</kbd>
          {(pageHits.length > 0 || hits.length > 0) && (
            <div className="search-results">
              {pageHits.map(p => <button type="button" key={p.id} onClick={() => setView(p.id)}>{p.label}</button>)}
              {hits.map(h => {
                const { view: dest, label, ...itemFocus } = h
                return <button type="button" key={`${dest}-${label}`} onClick={() => setView(dest, itemFocus)}>{label}</button>
              })}
            </div>
          )}
        </label>
        <nav>{visibleNav.map(entry => entry.id === 'orders' ? (
          <div key="orders" className="nest">
            <button className={`nav ${view === 'orders' ? 'on' : ''}`} onClick={() => setView('orders')}>
              <Inbox size={17} strokeWidth={1.6} />Orders
              {summary?.unfulfilled > 0 && <span className="count">{summary.unfulfilled}</span>}
            </button>
            {ordersOpen && <>
              <button className={`sub ${view === 'drafts' ? 'on' : ''}`} onClick={() => setView('drafts')}>Drafts</button>
              <button className={`sub ${view === 'checkouts' ? 'on' : ''}`} onClick={() => setView('checkouts')}>Abandoned checkouts</button>
            </>}
          </div>
        ) : entry.id === 'products' ? (
          <div key="products" className="nest">
            <button className={`nav ${view === 'products' ? 'on' : ''}`} onClick={() => setView('products')}>
              <Tag size={17} strokeWidth={1.6} />Products
            </button>
            {productsOpen && <>
              <button className={`sub ${view === 'collections' ? 'on' : ''}`} onClick={() => setView('collections')}>Collections</button>
              <button className={`sub ${view === 'inventory' ? 'on' : ''}`} onClick={() => setView('inventory')}>Inventory</button>
              <button className={`sub ${view === 'purchase-orders' ? 'on' : ''}`} onClick={() => setView('purchase-orders')}>Purchase orders</button>
              <button className={`sub ${view === 'transfers' ? 'on' : ''}`} onClick={() => setView('transfers')}>Transfers</button>
              <button className={`sub ${view === 'gift-cards' ? 'on' : ''}`} onClick={() => setView('gift-cards')}>Gift cards</button>
            </>}
          </div>
        ) : entry.id === 'customers' ? (
          <div key="customers" className="nest">
            <button className={`nav ${view === 'customers' ? 'on' : ''}`} onClick={() => setView('customers')}>
              <Users size={17} strokeWidth={1.6} />Customers
            </button>
            {customersOpen && <>
              <button className={`sub ${view === 'segments' ? 'on' : ''}`} onClick={() => setView('segments')}>Segments</button>
            </>}
          </div>
        ) : entry.id === 'markets' ? (
          <div key="markets" className="nest">
            <button className={`nav ${view === 'markets' ? 'on' : ''}`} onClick={() => setView('markets')}>
              <Globe size={17} strokeWidth={1.6} />Markets
            </button>
            {marketsOpen && <>
              <button className={`sub ${view === 'catalogs' ? 'on' : ''}`} onClick={() => setView('catalogs')}>Catalogs</button>
              <button className={`sub ${view === 'rollouts' ? 'on' : ''}`} onClick={() => setView('rollouts')}>Rollouts</button>
            </>}
          </div>
        ) : entry.id === 'analytics' ? (
          <div key="analytics" className="nest">
            <button className={`nav ${view === 'analytics' ? 'on' : ''}`} onClick={() => setView('analytics')}>
              <BarChart3 size={17} strokeWidth={1.6} />Analytics
            </button>
            {analyticsOpen && <>
              <button className={`sub ${view === 'reports' ? 'on' : ''}`} onClick={() => setView('reports')}>Reports</button>
              <button className={`sub ${view === 'live-view' ? 'on' : ''}`} onClick={() => setView('live-view')}>Live View</button>
            </>}
          </div>
        ) : item(entry))}</nav>
        {visibleChannels.length > 0 && <p className="group">Sales channels</p>}
        <nav>{visibleChannels.map(item)}</nav>
        <div className="foot">
          <div className="user-menu">
            <button type="button" className="nav" onClick={() => setWho(value => !value)}>{session?.name || 'Store owner'}</button>
            {who && (session?.people || []).map(person => (
              <button type="button" key={person.id} className={`sub ${person.id === session?.id ? 'on' : ''}`} onClick={() => useStaff(person.id)}>{person.name}</button>
            ))}
          </div>
          <ThemeToggle />
          {(can('settings') || can('users')) && item(SETTINGS)}
        </div>
      </aside>
      <main className={view === 'home' ? 'home-stage' : undefined}>
        {!viewOk && (
          <section className="panel">
            <h2>This area is limited</h2>
            <p>Your role does not include this part of the store. The store owner and the Administrator role can open every area.</p>
          </section>
        )}
        {viewOk && view === 'home' && <Home onOpen={setView} access={permissions} />}
        {viewOk && ordersOpen && <OrdersSection view={view} onChanged={reloadSummary} onOpen={setView} focus={focus} />}
        {viewOk && view === 'products' && <Products focus={focus} onOpen={setView} />}
        {viewOk && PRODUCT_VIEWS.includes(view) && <CatalogSection view={view} focus={focus} onOpen={setView} />}
        {viewOk && view === 'customers' && <Customers focus={focus} onOpen={setView} />}
        {viewOk && view === 'segments' && <Segments focus={focus} onOpen={setView} />}
        {viewOk && view === 'companies' && <Companies focus={focus} onOpen={setView} />}
        {viewOk && view === 'discounts' && <Discounts focus={focus} onOpen={setView} />}
        {viewOk && view === 'content' && <Content focus={focus} />}
        {viewOk && view === 'metaobjects' && <Metaobjects focus={focus} onOpen={setView} />}
        {viewOk && view === 'files' && <Files />}
        {viewOk && view === 'menus' && <Menus focus={focus} onOpen={setView} />}
        {viewOk && view === 'blog-posts' && <BlogPosts focus={focus} onOpen={setView} />}
        {viewOk && view === 'markets' && <Markets focus={focus} onOpen={setView} />}
        {viewOk && view === 'catalogs' && <Catalogs focus={focus} onOpen={setView} />}
        {viewOk && view === 'rollouts' && <Rollouts focus={focus} onOpen={setView} />}
        {viewOk && (view === 'growth' || view === 'attribution') && <Attribution focus={focus} onOpen={setView} />}
        {viewOk && view === 'autopilot' && <Autopilot onOpen={setView} />}
        {viewOk && view === 'campaigns' && <Campaigns focus={focus} onOpen={setView} />}
        {viewOk && view === 'analytics' && <Analytics onOpen={setView} />}
        {viewOk && view === 'reports' && <Reports focus={focus} onOpen={setView} />}
        {viewOk && view === 'live-view' && <LiveView onOpen={setView} />}
        {viewOk && view === 'store' && <StorePage onOpen={setView} />}
        {viewOk && view === 'agentic' && <AgenticPage onOpen={setView} />}
        {viewOk && view === 'settings' && <SettingsPage focus={focus} onOpen={setView} access={permissions} />}
      </main>
    </div>
  )
}
