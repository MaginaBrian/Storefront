import { useState } from 'react'
import { Modal } from '../components/Modal.jsx'

export default function OrderForm({ mode, onClose, onSaved, initialCustomer = '' }) {
  const [customer, setCustomer] = useState(initialCustomer)
  const [total, setTotal] = useState('')
  const [items, setItems] = useState('1')
  const [po, setPo] = useState('')
  const [channel, setChannel] = useState('Draft Orders')
  const [payment, setPayment] = useState('pending')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = e => {
    e.preventDefault()
    if (!customer.trim()) { setError('Enter a customer name.'); return }
    const cents = Math.round(Number(total) * 100)
    if (!Number.isFinite(cents) || cents < 0) { setError('Enter a valid total.'); return }
    const body = mode === 'draft'
      ? { customer: customer.trim(), total: cents, po: po.trim() }
      : { customer: customer.trim(), total: cents, items: Number(items) || 1, channel, payment }
    setBusy(true)
    fetch(mode === 'draft' ? '/api/drafts' : '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Could not save')
      onSaved(await r.json())
      onClose()
    }).catch(err => { setError(err.message); setBusy(false) })
  }

  return (
    <Modal title={mode === 'draft' ? 'Create draft order' : 'Create order'} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Customer<input autoFocus value={customer} onChange={e => setCustomer(e.target.value)} /></label>
        <label>Total (KES)<input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="0.00" /></label>
        {mode === 'draft'
          ? <label>PO number<input value={po} onChange={e => setPo(e.target.value)} /></label>
          : <>
            <label>Items<input inputMode="numeric" value={items} onChange={e => setItems(e.target.value)} /></label>
            <label>Channel
              <select value={channel} onChange={e => setChannel(e.target.value)}>
                <option>Draft Orders</option><option>Online Store</option><option>Agentic</option>
              </select>
            </label>
            <label>Payment
              <select value={payment} onChange={e => setPayment(e.target.value)}>
                <option value="pending">Payment pending</option>
                <option value="paid">Paid</option>
              </select>
            </label>
          </>}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
