import { useEffect, useState } from 'react'
import { BarChart3, FileText, Globe, Inbox, Search, Smartphone, Tag, Users } from 'lucide-react'
import CatalogSection from './catalog/index.jsx'
import Home from './home/Home.jsx'
import { useApi } from './lib/api.js'
import { ANALYTICS_VIEWS, CHANNELS, CONTENT_VIEWS, CUSTOMER_VIEWS, MARKET_VIEWS, NAV, PRODUCT_VIEWS, SETTINGS, readRoute } from './nav.js'
import OrdersSection from './orders/index.jsx'
import { AgenticPage, Analytics, BlogPosts, Catalogs, Companies, Content, Customers, Discounts, Files, Growth, LiveView, Markets, Menus, Metaobjects, Products, Reports, Rollouts, Segments, Settings as SettingsPage, StorePage } from './pages/index.js'

export default function App() {
  const initial = readRoute()
  const [view, setViewState] = useState(initial.view)
  const [focus, setFocus] = useState(initial.focus)
  const [summary, reloadSummary] = useApi('/api/orders/summary')
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState([])
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
      fetch(`/api/search?q=${encodeURIComponent(search.trim())}`).then(r => r.json()).then(setHits).catch(() => setHits([]))
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
  const pages = [...NAV, ...CHANNELS, SETTINGS, { id: 'drafts', label: 'Drafts' }, { id: 'checkouts', label: 'Abandoned checkouts' }, { id: 'collections', label: 'Collections' }, { id: 'inventory', label: 'Inventory' }, { id: 'purchase-orders', label: 'Purchase orders' }, { id: 'transfers', label: 'Transfers' }, { id: 'gift-cards', label: 'Gift cards' }, { id: 'segments', label: 'Segments' }, { id: 'companies', label: 'Companies' }, { id: 'metaobjects', label: 'Metaobjects' }, { id: 'files', label: 'Files' }, { id: 'menus', label: 'Menus' }, { id: 'blog-posts', label: 'Blog posts' }, { id: 'catalogs', label: 'Catalogs' }, { id: 'rollouts', label: 'Rollouts' }, { id: 'reports', label: 'Reports' }, { id: 'live-view', label: 'Live View' }]
  const pageHits = search.trim().length < 2 ? [] : pages.filter(p => p.label.toLowerCase().includes(search.trim().toLowerCase()))
  const item = ({ id, label, icon: Icon }) => (
    <button key={id} className={`nav ${view === id ? 'on' : ''}`} onClick={() => setView(id)}>
      <Icon size={17} strokeWidth={1.6} />{label}
    </button>
  )
  const ordersOpen = view === 'orders' || view === 'drafts' || view === 'checkouts'
  const productsOpen = view === 'products' || PRODUCT_VIEWS.includes(view)
  const customersOpen = view === 'customers' || CUSTOMER_VIEWS.includes(view)
  const contentOpen = view === 'content' || CONTENT_VIEWS.includes(view)
  const marketsOpen = view === 'markets' || MARKET_VIEWS.includes(view)
  const analyticsOpen = view === 'analytics' || ANALYTICS_VIEWS.includes(view)
  return (
    <div className="shell">
      <aside>
        <button type="button" className="brand" onClick={() => setView('home')}>Maison</button>
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
        <nav>{NAV.map(entry => entry.id === 'orders' ? (
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
              <button className={`sub ${view === 'companies' ? 'on' : ''}`} onClick={() => setView('companies')}>Companies</button>
            </>}
          </div>
        ) : entry.id === 'content' ? (
          <div key="content" className="nest">
            <button className={`nav ${view === 'content' ? 'on' : ''}`} onClick={() => setView('content')}>
              <FileText size={17} strokeWidth={1.6} />Content
            </button>
            {contentOpen && <>
              <button className={`sub ${view === 'metaobjects' ? 'on' : ''}`} onClick={() => setView('metaobjects')}>Metaobjects</button>
              <button className={`sub ${view === 'files' ? 'on' : ''}`} onClick={() => setView('files')}>Files</button>
              <button className={`sub ${view === 'menus' ? 'on' : ''}`} onClick={() => setView('menus')}>Menus</button>
              <button className={`sub ${view === 'blog-posts' ? 'on' : ''}`} onClick={() => setView('blog-posts')}>Blog posts</button>
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
        <p className="group">Sales channels</p>
        <nav>{CHANNELS.map(item)}</nav>
        <div className="promo">
          <strong>Run your store anywhere</strong>
          <p>Get order alerts, low-stock warnings and live sales on your phone.</p>
          <button className="cta"><Smartphone size={14} /> Get the app</button>
        </div>
        <div className="foot">{item(SETTINGS)}</div>
      </aside>
      <main>
        {view === 'home' && <Home onOpen={setView} />}
        {ordersOpen && <OrdersSection view={view} onChanged={reloadSummary} onOpen={setView} focus={focus} />}
        {view === 'products' && <Products focus={focus} onOpen={setView} />}
        {PRODUCT_VIEWS.includes(view) && <CatalogSection view={view} focus={focus} onOpen={setView} />}
        {view === 'customers' && <Customers focus={focus} onOpen={setView} />}
        {view === 'segments' && <Segments onOpen={setView} />}
        {view === 'companies' && <Companies focus={focus} onOpen={setView} />}
        {view === 'discounts' && <Discounts />}
        {view === 'content' && <Content focus={focus} />}
        {view === 'metaobjects' && <Metaobjects focus={focus} onOpen={setView} />}
        {view === 'files' && <Files />}
        {view === 'menus' && <Menus focus={focus} onOpen={setView} />}
        {view === 'blog-posts' && <BlogPosts focus={focus} onOpen={setView} />}
        {view === 'markets' && <Markets focus={focus} onOpen={setView} />}
        {view === 'catalogs' && <Catalogs focus={focus} onOpen={setView} />}
        {view === 'rollouts' && <Rollouts />}
        {view === 'growth' && <Growth focus={focus} onOpen={setView} />}
        {view === 'analytics' && <Analytics onOpen={setView} />}
        {view === 'reports' && <Reports focus={focus} onOpen={setView} />}
        {view === 'live-view' && <LiveView onOpen={setView} />}
        {view === 'store' && <StorePage onOpen={setView} />}
        {view === 'agentic' && <AgenticPage onOpen={setView} />}
        {view === 'settings' && <SettingsPage focus={focus} onOpen={setView} />}
      </main>
    </div>
  )
}
