export function blankOrder(customer = '') {
  return { customer, total: '', items: '1', channel: 'Draft Orders', payment: 'pending' }
}

export function blankDraft(customer = '') {
  return { customer, total: '', po: '' }
}

export function purchaseLine(item) {
  return { inventory_id: item.id, title: `${item.product} · ${item.variant}`, qty: 1, price: 0, sku: item.sku || '', supplier_sku: '', discount: 0 }
}

export function transferLine(item) {
  return { inventory_id: item.id, title: `${item.product} · ${item.variant}`, qty: 1, price: item.price || 0 }
}
