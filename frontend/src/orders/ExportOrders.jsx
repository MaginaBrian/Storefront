import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal.jsx'
import { csv } from '../lib/csv.js'
import { money } from '../lib/money.js'
import { formatWhen } from './time.js'

const HEADERS = ['Order', 'Date', 'Customer', 'Channel', 'Total', 'Payment', 'Fulfillment', 'Items', 'Delivery method']

function orderRow(order) {
  return [order.id, formatWhen(order.created_at), order.customer, order.channel, money(order.total), order.payment, order.fulfillment, order.items, order.delivery_method]
}

export default function ExportOrders({ rows, shown, picked, searching, onClose }) {
  const [scope, setScope] = useState('page')
  const [kind, setKind] = useState('excel')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [lines, setLines] = useState([])

  useEffect(() => {
    fetch('/api/order-lines').then(r => r.json()).then(setLines).catch(() => setLines([]))
  }, [])

  const dated = rows.filter(order => {
    const day = String(order.created_at).slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return Boolean(from || to)
  })
  const selected = rows.filter(order => picked.has(order.id))
  const sets = {
    page: shown,
    all: rows,
    selected,
    search: shown,
    date: dated,
  }
  const chosen = sets[scope] || []
  const excel = kind === 'excel'

  const downloadOrders = () => {
    csv([HEADERS, ...chosen.map(orderRow)], 'orders.csv', { excel })
    onClose()
  }
  const downloadLines = () => {
    const ids = new Set(chosen.map(order => order.id))
    const history = lines.filter(line => ids.has(line.order_id))
    csv([
      ['Order', 'Date', 'Customer', 'Item', 'Price', 'Quantity', 'Line total'],
      ...history.map(line => [line.order_id, formatWhen(line.created_at), line.customer, line.title, money(line.price), line.qty, money(line.line_total)]),
    ], 'order-transactions.csv', { excel })
    onClose()
  }

  return (
    <Modal title="Export orders" onClose={onClose}>
      <div className="export-body">
        <fieldset>
          <legend>Export</legend>
          <label className="choice"><input type="radio" name="scope" checked={scope === 'page'} onChange={() => setScope('page')} />Current page</label>
          <label className="choice"><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />All orders</label>
          <label className={`choice ${selected.length ? '' : 'off'}`}>
            <input type="radio" name="scope" disabled={!selected.length} checked={scope === 'selected'} onChange={() => setScope('selected')} />
            Selected: {selected.length} orders
          </label>
          <label className={`choice ${searching ? '' : 'off'}`}>
            <input type="radio" name="scope" disabled={!searching} checked={scope === 'search'} onChange={() => setScope('search')} />
            {shown.length} orders matching your search
          </label>
          <label className="choice"><input type="radio" name="scope" checked={scope === 'date'} onChange={() => setScope('date')} />Orders by date</label>
          {scope === 'date' && (
            <div className="date-range">
              <label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
              <label>To<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
            </div>
          )}
        </fieldset>
        <fieldset>
          <legend>Export as</legend>
          <label className="choice"><input type="radio" name="kind" checked={kind === 'excel'} onChange={() => setKind('excel')} />CSV for Excel, Numbers, or other spreadsheet programs</label>
          <label className="choice"><input type="radio" name="kind" checked={kind === 'plain'} onChange={() => setKind('plain')} />Plain CSV file</label>
        </fieldset>
      </div>
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="ghost" disabled={!chosen.length} onClick={downloadLines}>Export transaction histories</button>
        <button type="button" className="solid" disabled={!chosen.length} onClick={downloadOrders}>Export orders</button>
      </div>
    </Modal>
  )
}
