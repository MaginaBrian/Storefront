import { request } from './client.js'

function resource(path) {
  return {
    list: () => request(path),
    read: id => request(`${path}/${encodeURIComponent(id)}`),
    create: body => request(path, { method: 'POST', body }),
    patch: (id, body) => request(id == null ? path : `${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    act: (id, body) => request(`${path}/${encodeURIComponent(id)}`, { method: 'POST', body }),
    remove: id => request(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}

export const orders = {
  ...resource('/api/orders'),
  summary: () => request('/api/orders/summary'),
  lines: () => request('/api/order-lines'),
  profile: customer => request(`/api/profile?customer=${encodeURIComponent(customer)}`),
}
export const drafts = resource('/api/drafts')
export const products = resource('/api/products')
export const collections = resource('/api/collections')
export const inventory = {
  ...resource('/api/inventory'),
  importFile: file => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/inventory/import', { method: 'POST', form })
  },
}
export const purchaseOrders = resource('/api/purchase-orders')
export const transfers = resource('/api/transfers')
export const giftCards = resource('/api/gift-cards')
export const customers = resource('/api/customers')
export const segments = resource('/api/segments')
export const companies = resource('/api/companies')
export const discounts = resource('/api/discounts')
export const files = resource('/api/files')
export const menus = resource('/api/menus')
export const blogPosts = resource('/api/blog-posts')
export const marketCatalogs = resource('/api/market-catalogs')
export const rollouts = resource('/api/rollouts')
export const markets = resource('/api/markets')
export const campaigns = resource('/api/campaigns')
export const settings = {
  list: () => request('/api/settings'),
  update: body => request('/api/settings', { method: 'PATCH', body }),
}
export const reports = resource('/api/reports')
export const search = term => request(`/api/search?q=${encodeURIComponent(term)}`)
export const metaDefinitions = body => request('/api/metaobjects/definitions', { method: 'POST', body })
