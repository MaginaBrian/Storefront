export function cents(value) {
  const number = Number(String(value).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(number)) return null
  return Math.round(number * 100)
}

export function orderPayload({ customer, total, items, channel, payment }) {
  return {
    customer: customer.trim(),
    total: cents(total),
    items: Number(items) || 1,
    channel,
    payment,
  }
}

export function draftMoneyPayload(form) {
  return {
    customer: form.customer.trim(),
    lines: (form.lines || []).map(line => ({
      title: line.title,
      price: line.price,
      qty: line.qty,
      size: line.size,
      color: line.color || line.variant || '',
    })),
    discount: form.discount,
    shipping: form.shipping,
    note: (form.note || '').trim(),
    tags: (form.tags || '').trim(),
    currency: form.currency,
    phone: (form.phone || '').trim(),
    email: (form.email || '').trim(),
    address: (form.address || '').trim(),
    ...(form.po != null ? { po: form.po, total: cents(form.total) } : {}),
  }
}

export function simpleDraftPayload({ customer, total, po }) {
  return { customer: customer.trim(), total: cents(total), po: po.trim() }
}

export function lineTotal(line) {
  const gross = Number(line.price || 0) * Number(line.qty || 0)
  return Math.round(gross * (100 - Number(line.discount || 0)) / 100)
}

export function purchaseOrderPayload(form) {
  return {
    supplier: form.supplier,
    destination: form.destination,
    reference: form.reference,
    note: form.note,
    terms: form.terms,
    currency: 'KES',
    tags: form.tags || '',
    lines: form.lines,
  }
}

export function transferPayload(form) {
  return {
    origin: form.origin,
    destination: form.destination,
    reference: form.reference,
    note: form.note,
    tags: form.tags,
    purchase_order: form.purchaseOrder,
    lines: form.lines,
  }
}

export function giftCardPayload(form) {
  return {
    code: form.code,
    customer: form.customer,
    balance: cents(form.amount),
    note: form.note,
    expires: form.expires,
  }
}

export function productPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description,
    status: form.status,
    category: form.category,
    product_type: form.productType,
    vendor: form.vendor,
    media: form.media,
    price: form.price,
    stock: form.stock,
    tags: form.tags,
    fields: form.fields,
    collections: form.collections,
    extra: form.extra,
  }
}

export function collectionPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description,
    image: form.image,
    conditions: form.conditions,
    excludes: form.excludes,
    products: form.products,
    channels: form.channels,
    theme: form.theme,
    seo_title: form.seoTitle.trim() || form.title.trim(),
    seo_description: form.seoDescription.trim() || form.description.trim(),
    sort: form.sort,
  }
}

export function customerPayload(form) {
  return {
    first_name: form.first.trim(),
    last_name: form.last.trim(),
    email: form.email,
    phone: form.phone,
    language: form.language,
    email_marketing: form.emailMarketing,
    sms: form.sms,
    whatsapp: form.whatsapp,
    note: form.note,
    tags: form.tags,
    location: form.city,
    address: form.address,
    tax_settings: form.tax,
  }
}

export function inventoryPayload(form) {
  return { product: form.product.trim(), variant: form.variant.trim() || 'Default', on_hand: Number(form.onHand) }
}
