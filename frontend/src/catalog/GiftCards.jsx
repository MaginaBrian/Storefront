import { useJson } from '../lib/api.js'
import { csv } from '../lib/csv.js'
import { CreateGiftCard } from './CreateForms.jsx'
import { GiftMark } from './ui.jsx'

export function GiftCards({ onOpen, focus = {} }) {
  const [rows, reload] = useJson('/api/gift-cards')
  if (focus.create === '1') return <CreateGiftCard onOpen={onOpen} onSaved={reload} />
  if (!rows) return <p className="muted">Loading gift cards…</p>
  return (
    <>
      <div className="orders-top">
        <h1>Gift cards</h1>
        <button type="button" className="ghost" onClick={() => csv([['Code', 'Customer', 'Balance', 'Status'], ...rows.map(r => [r.code, r.customer, (r.balance / 100).toFixed(2), r.status])], 'gift-cards.csv')}>Export</button>
      </div>
      {rows.length === 0 ? (
        <section className="panel empty-hero catalog-empty">
          <GiftMark />
          <div>
            <h2>Start selling gift cards</h2>
            <p>Add gift card products to sell or create gift cards and send them directly to your customers.</p>
            <div className="orders-actions" style={{ marginTop: 16 }}>
              <button type="button" className="ghost" onClick={() => onOpen('gift-cards', { create: '1' })}>Create gift card</button>
              <button type="button" className="solid" onClick={() => onOpen('products', { add: '1', gift: '1' })}>Add gift card product</button>
            </div>
          </div>
        </section>
      ) : (
        <div className="sheet">
          <table>
            <thead><tr><th>Code</th><th>Customer</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{r.customer ? <button type="button" className="text-link" onClick={() => onOpen('customers', { customer: r.customer })}>{r.customer}</button> : '—'}</td>
                  <td>KES {(r.balance / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <a className="learn" href="https://help.shopify.com/en/manual/products/gift-card-products" target="_blank" rel="noreferrer">Learn more about gift cards</a>
    </>
  )
}
