import {
  BarChart3, FileText, Globe, House, Inbox, Percent, Settings, Sparkles, Store, Tag, TrendingUp, Users,
} from 'lucide-react'

export const NAV = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'orders', label: 'Orders', icon: Inbox },
  { id: 'products', label: 'Products', icon: Tag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'growth', label: 'Growth', icon: TrendingUp },
  { id: 'discounts', label: 'Discounts', icon: Percent },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'markets', label: 'Markets', icon: Globe },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]
export const CHANNELS = [
  { id: 'store', label: 'Online Store', icon: Store },
  { id: 'agentic', label: 'Agentic', icon: Sparkles },
]
export const SETTINGS = { id: 'settings', label: 'Settings', icon: Settings }

export const PRODUCT_VIEWS = ['collections', 'inventory', 'purchase-orders', 'transfers', 'gift-cards']
export const CUSTOMER_VIEWS = ['segments', 'companies']
export const CONTENT_VIEWS = ['metaobjects', 'files', 'menus', 'blog-posts']
export const MARKET_VIEWS = ['catalogs', 'rollouts']
export const VIEWS = new Set([...NAV, ...CHANNELS, SETTINGS].map(n => n.id).concat(['drafts', 'checkouts', ...PRODUCT_VIEWS, ...CUSTOMER_VIEWS, ...CONTENT_VIEWS, ...MARKET_VIEWS]))

export function readRoute() {
  const [path, qs = ''] = location.hash.replace(/^#\/?/, '').split('?')
  return {
    view: VIEWS.has(path) ? path : 'home',
    focus: Object.fromEntries(new URLSearchParams(qs)),
  }
}
