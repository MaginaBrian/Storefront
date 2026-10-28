export const CATALOG_KINDS = {
  full: 'Full catalog',
  pricing: 'Pricing only',
  publication: 'Publication only',
}

export function catalogPrice(cents, { kind, adjustment, fixed }) {
  const base = Number(cents) || 0
  if (kind === 'publication') return base
  if (fixed != null && fixed !== '') return Number(fixed)
  const percent = Number(adjustment) || 0
  return Math.max(0, Math.round(base * (100 + percent) / 100))
}

export function catalogError({ title, markets, kind, adjust, auto, included }) {
  if (!title.trim()) return 'Enter a catalog title.'
  if (!markets.length) return 'Add a market.'
  const percent = Number(adjust)
  if (kind !== 'publication' && (!Number.isFinite(percent) || percent < 0 || percent > 1000)) {
    return 'Enter an adjustment between 0 and 1000.'
  }
  if (kind !== 'pricing' && !auto && included.size === 0) return 'Include at least one product.'
  return ''
}

export function catalogPayload({ title, kind, status, markets, adjust, direction, compare, auto, included, prices }) {
  const amount = Math.abs(Number(adjust) || 0)
  const nextPrices = {}
  if (kind !== 'publication') {
    for (const [id, cents] of Object.entries(prices)) nextPrices[id] = cents
  }
  return {
    title: title.trim(),
    kind,
    status,
    markets,
    adjustment: kind === 'publication' ? 0 : (direction === 'Decrease' ? -amount : amount),
    compare: kind !== 'publication' && compare,
    auto_include: kind === 'pricing' ? true : auto,
    products: kind === 'pricing' || auto ? [] : [...included],
    prices: nextPrices,
  }
}
