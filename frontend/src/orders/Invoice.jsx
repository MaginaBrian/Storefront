import { useEffect, useState } from 'react'
import { money } from '../lib/money.js'

function ticketDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(2)
  return `${day}/${month}/${year}`
}

function pattern(text) {
  const size = 29
  const cells = Array.from({ length: size }, () => Array(size).fill(0))
  const finder = (row, col) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4
        cells[row + y][col + x] = edge || core ? 1 : 0
      }
    }
  }
  finder(0, 0)
  finder(0, size - 7)
  finder(size - 7, 0)
  let hash = 2166136261
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const quiet = (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9)
      if (cells[y][x] || quiet) continue
      hash = Math.imul(hash ^ (x * 31 + y), 16777619)
      cells[y][x] = (hash >>> 0) % 3 === 0 ? 1 : 0
    }
  }
  return cells
}

function Mark({ value }) {
  const cells = pattern(value)
  const size = cells.length
  return (
    <svg className="ticket-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Invoice code">
      {cells.flatMap((row, y) => row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null))}
    </svg>
  )
}

function Bars({ value }) {
  const widths = [...value].flatMap(char => {
    const code = char.charCodeAt(0)
    return [1, (code % 3) + 1, 1, (code % 4) + 1]
  })
  let cursor = 0
  const bars = widths.map((width, index) => {
    const bar = { x: cursor, width, on: index % 2 === 0 }
    cursor += width
    return bar
  })
  return (
    <svg className="ticket-bars" viewBox={`0 0 ${cursor} 42`} preserveAspectRatio="none" role="img" aria-label={value}>
      {bars.filter(bar => bar.on).map(bar => <rect key={bar.x} x={bar.x} y="0" width={bar.width} height="42" />)}
    </svg>
  )
}

function blank(value) {
  return value && String(value).trim() ? value : '—'
}

export default function Invoice({ draftId, onOpen }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setData(null)
    setError('')
    fetch(`/api/drafts/${encodeURIComponent(draftId)}`).then(async response => {
      if (!response.ok) throw new Error('missing')
      return response.json()
    }).then(body => { if (!ignore) setData(body) }).catch(() => { if (!ignore) setError('This invoice is not in the store.') })
    return () => { ignore = true }
  }, [draftId])

  if (error) {
    return (
      <section className="panel">
        <h2>Invoice</h2>
        <p>{error}</p>
        <button type="button" className="ghost" onClick={() => onOpen('drafts')}>Back to drafts</button>
      </section>
    )
  }
  if (!data) return <p className="muted">Preparing the invoice…</p>

  const { draft, lines, customer, summary } = data
  const code = `${draft.id}`.replace(/\D/g, '').padStart(8, '0')
  const barcode = `9941${code}009708`

  return (
    <div className="ticket-page">
      <div className="ticket-actions">
        <button type="button" className="ghost" onClick={() => onOpen('drafts', { draft: draft.id })}>Back to draft</button>
        <button type="button" className="solid" onClick={() => window.print()}>Print</button>
      </div>
      <article className="ticket">
        <h1>Cosine</h1>
        <div className="ticket-meta">
          <span>Order number</span>
          <span>{ticketDate(draft.created_at)}</span>
        </div>
        <p className="ticket-id">{draft.id}</p>
        <dl className="ticket-client">
          <div><dt>Name</dt><dd>{blank(customer.name)}</dd></div>
          <div><dt>Mobile</dt><dd>{blank(customer.phone)}</dd></div>
          <div><dt>Email</dt><dd>{blank(customer.email)}</dd></div>
          <div><dt>Delivery address</dt><dd>{blank(customer.address)}</dd></div>
        </dl>
        <Mark value={`${draft.id}-${customer.name}`} />
        <ul className="ticket-lines">
          {lines.map(line => (
            <li key={line.id}>
              <div>
                <strong>{line.title}</strong>
                <span>Size {blank(line.size)} · Color {blank(line.color)} · Qty {line.qty}</span>
              </div>
              <b>{money(line.line_total)}</b>
            </li>
          ))}
        </ul>
        <dl className="ticket-totals">
          <div><dt>Subtotal</dt><dd>{money(summary.subtotal)}</dd></div>
          <div><dt>Shipping</dt><dd>{money(summary.shipping)}</dd></div>
          <div><dt>Total</dt><dd>{money(summary.total)}</dd></div>
        </dl>
        <p className="ticket-note">This receipt is required if you want to exchange or return an item. You can show it on your phone or print it.</p>
        <Bars value={barcode} />
        <p className="ticket-code">{barcode}</p>
      </article>
    </div>
  )
}
