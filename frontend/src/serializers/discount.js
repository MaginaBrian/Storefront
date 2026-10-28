import { blankDiscount, discountType } from '../models/discount.js'

function parseConfig(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

export function discountFromRow(row) {
  const config = parseConfig(row.config)
  if (config.type) return { ...blankDiscount(config.type), ...config, id: row.id }
  const type = discountType(row.kind)
  const form = blankDiscount(type)
  form.id = row.id
  form.code = row.code
  form.applies = 'All products'
  if (String(row.value).includes('%')) {
    form.valueMode = 'percent'
    form.percent = String(row.value).replace('%', '').trim()
  } else if (type !== 'shipping') {
    form.valueMode = 'amount'
    form.amount = String(row.value).replace(/[^\d.]/g, '')
  }
  return form
}

export function discountValue(form) {
  if (form.type === 'shipping') return 'Free shipping'
  if (form.type === 'bxgy') {
    const off = form.getMode === 'free' ? 'free' : form.getMode === 'amount' ? `KES ${form.getValue || 0} off` : `${form.getValue || 0}% off`
    return `Buy ${form.buyQty || 1} get ${form.getQty || 1} ${off}`
  }
  if (form.valueMode === 'amount') return form.amount ? `KES ${form.amount}` : ''
  return form.percent ? `${form.percent}%` : ''
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function discountError(form) {
  if (form.method === 'automatic') {
    if (!form.title.trim()) return 'Enter a title customers will see.'
  } else if (!form.code.trim()) return 'Enter a discount code.'
  if (form.type === 'products' || form.type === 'order') {
    if (form.valueMode === 'amount') {
      if (number(form.amount) <= 0) return 'Enter a discount amount.'
    } else if (number(form.percent) <= 0 || number(form.percent) > 100) return 'Enter a percentage between 0 and 100.'
  }
  if (form.type === 'bxgy') {
    if (form.buyMode === 'amount') {
      if (number(form.buyAmount) <= 0) return 'Enter a minimum purchase amount.'
    } else if (number(form.buyQty) <= 0) return 'Enter a minimum quantity.'
    if (!form.buyPicks.length) return 'Add the products the customer buys.'
    if (number(form.getQty) <= 0) return 'Enter how many items the customer gets.'
    if (!form.getPicks.length) return 'Add the products the customer gets.'
    if (form.getMode !== 'free' && number(form.getValue) <= 0) return 'Enter the discounted value.'
    if (form.maxPerOrder && number(form.maxPerOrderQty) <= 0) return 'Enter the maximum uses per order.'
  }
  if (form.type === 'products' && form.applies === 'Specific products' && !form.picks.length) return 'Add at least one product.'
  if (form.type === 'products' && form.applies === 'Specific collections' && !form.picks.length) return 'Choose at least one collection.'
  if (form.type === 'shipping' && form.countries === 'selected' && !form.countryList.length) return 'Choose at least one country.'
  if (form.type === 'shipping' && form.excludeRates && number(form.excludeAmount) <= 0) return 'Enter the maximum shipping rate.'
  if (form.eligibility === 'Specific customer segments' && !form.segments.length) return 'Choose at least one customer segment.'
  if (form.minimum === 'amount' && number(form.minimumAmount) <= 0) return 'Enter a minimum purchase amount.'
  if (form.minimum === 'qty' && number(form.minimumQty) <= 0) return 'Enter a minimum quantity.'
  if (form.limitTotal && number(form.usageLimit) <= 0) return 'Enter how many times this discount can be used.'
  if (form.showEnd && !form.ends) return 'Set an end date.'
  if (!form.starts) return 'Set a start date.'
  return ''
}

export function pickName(pick) {
  return typeof pick === 'string' ? pick : pick.product
}

export function productLines(picks) {
  const groups = new Map()
  for (const pick of picks) {
    const name = pickName(pick)
    const variant = typeof pick === 'string' ? '' : pick.variant
    if (!groups.has(name)) groups.set(name, [])
    if (variant) groups.get(name).push(variant)
  }
  return [...groups].map(([name, variants]) => variants.length ? `${name} (${variants.length} ${variants.length === 1 ? 'variant' : 'variants'})` : name)
}

function whenLabel(value) {
  if (!value) return 'today'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'today'
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'today'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function discountDetails(form) {
  const lines = [form.eligibility === 'All customers' ? 'All customers' : (form.segments.join(', ') || 'Specific customer segments')]
  lines.push('For Online Store')
  if (form.type === 'products' && form.applies === 'Specific products') {
    const value = discountValue(form)
    lines.push(...productLines(form.picks).map(name => `${value ? `${value} off ` : ''}${name}`))
  }
  if (form.type === 'shipping') lines.push(form.countries === 'all' ? 'For all countries' : (form.countryList.join(', ') || 'Selected countries'))
  if (form.minimum === 'none') lines.push('No minimum purchase requirement')
  else if (form.minimum === 'amount') lines.push(`Minimum purchase of KES ${form.minimumAmount || 0}`)
  else lines.push(`Minimum quantity of ${form.minimumQty || 0}`)
  if (!form.limitTotal && !form.once) lines.push('No usage limits')
  if (form.limitTotal) lines.push(`Limited to ${form.usageLimit || 0} uses`)
  if (form.once) lines.push('One use per customer')
  lines.push(form.combines ? 'Can combine with other discounts' : "Can't combine with other discounts")
  lines.push(`Active from ${whenLabel(form.starts)}`)
  return lines
}

export function discountPayload(form, kind) {
  return {
    method: form.method,
    code: form.code,
    title: form.title,
    kind,
    value: discountValue(form) || 'Free shipping',
    config: { ...form, id: undefined },
  }
}
