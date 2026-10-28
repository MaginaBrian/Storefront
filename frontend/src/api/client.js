const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || ''
  if (!url.startsWith('/api/')) return nativeFetch(input, init)
  const headers = new Headers(init.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined))
  const staff = localStorage.getItem('storefront-staff')
  if (staff && !headers.has('X-Staff-Id')) headers.set('X-Staff-Id', staff)
  return nativeFetch(input, { ...init, headers })
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const staff = localStorage.getItem('storefront-staff')
  if (staff) headers['X-Staff-Id'] = staff
  const options = { method, headers }
  if (form) {
    options.body = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const response = await fetch(path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.error || 'Request failed', response.status)
  return payload
}
