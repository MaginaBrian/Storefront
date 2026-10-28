export function discountType(kind) {
  if (kind === 'Free shipping') return 'shipping'
  if (kind === 'Fixed amount' || kind === 'Amount off order') return 'order'
  if (kind === 'Buy X get Y') return 'bxgy'
  return 'products'
}

export function blankDiscount(type = 'products') {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const starts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  return {
    type,
    method: 'code',
    code: '',
    title: '',
    valueMode: 'percent',
    percent: '',
    amount: '',
    applies: 'Specific products',
    picks: [],
    buyMode: 'qty',
    buyQty: '1',
    buyAmount: '',
    buyFrom: 'Specific products',
    buyPicks: [],
    getQty: '1',
    getFrom: 'Specific products',
    getPicks: [],
    getMode: 'percent',
    getValue: '',
    maxPerOrder: false,
    maxPerOrderQty: '',
    eligibility: 'All customers',
    segments: [],
    minimum: 'none',
    minimumAmount: '',
    minimumQty: '',
    limitTotal: false,
    usageLimit: '',
    once: false,
    combines: false,
    starts,
    ends: '',
    showEnd: false,
    countries: 'all',
    countryList: ['Kenya'],
    excludeRates: false,
    excludeAmount: '',
    featured: false,
    tags: '',
  }
}
