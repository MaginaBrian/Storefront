export const STAFF_KEY = 'storefront-staff'

export const AREAS = [
  ['home', 'Home', 'Open the store overview.'],
  ['orders', 'Orders', 'Record the purchase: the customer, products and variants, quantities, prices, discounts, shipping, and fulfillment.'],
  ['products', 'Products', 'What you sell, including variants, prices, and inventory.'],
  ['customers', 'Customers', 'Who buys, with their contact details and whether they return.'],
  ['discounts', 'Discounts', 'The offer. Reduce a product price, an order total, or shipping.'],
  ['markets', 'Markets', 'Who you sell to, and the prices, currency, and catalog they see. Markets are separate from marketing.'],
  ['analytics', 'Analytics', 'The results: what sold, how discounts changed the total, and which customers came back.'],
  ['settings', 'Settings', 'Store details such as the name, currency, and checkout.'],
  ['users', 'Users', 'Create roles and decide who can open each part of the store.'],
]

export const APPS = [
  ['online_store', 'Online Store', 'The public shop.'],
  ['agentic', 'Agentic', 'The shop assistant.'],
]

const VIEWS = {
  home: 'home',
  orders: 'orders',
  drafts: 'orders',
  checkouts: 'orders',
  products: 'products',
  collections: 'products',
  inventory: 'products',
  'purchase-orders': 'products',
  transfers: 'products',
  'gift-cards': 'products',
  content: 'products',
  metaobjects: 'products',
  files: 'products',
  menus: 'products',
  'blog-posts': 'products',
  customers: 'customers',
  segments: 'customers',
  companies: 'customers',
  discounts: 'discounts',
  markets: 'markets',
  catalogs: 'markets',
  rollouts: 'markets',
  analytics: 'analytics',
  reports: 'analytics',
  'live-view': 'analytics',
  growth: 'analytics',
  attribution: 'analytics',
  autopilot: 'analytics',
  campaigns: 'analytics',
  store: 'online_store',
  agentic: 'agentic',
}

export function storedStaff() {
  return localStorage.getItem(STAFF_KEY) || ''
}

export function useStaff(id) {
  localStorage.setItem(STAFF_KEY, String(id))
  location.reload()
}

export function allowed(view, permissions) {
  if (!permissions) return false
  if (view === 'settings') return permissions.includes('settings') || permissions.includes('users')
  return permissions.includes(VIEWS[view] || 'home')
}
