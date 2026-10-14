import { useState } from 'react'
import { Modal } from '../components/Modal.jsx'

function CartMark() {
  return (
    <svg className="cart-mark" viewBox="0 0 120 90" aria-hidden="true">
      <rect x="8" y="18" width="78" height="58" rx="16" fill="#e7f6ef" />
      <path d="M28 38h34l-4 16H32z" fill="none" stroke="#1f8a4c" strokeWidth="2.4" />
      <circle cx="36" cy="62" r="3" fill="#1f8a4c" />
      <circle cx="54" cy="62" r="3" fill="#1f8a4c" />
      <circle cx="92" cy="28" r="16" fill="#fff" stroke="#e5262b" strokeWidth="2" />
      <path d="M86 22l12 12M98 22L86 34" stroke="#e5262b" strokeWidth="2" />
    </svg>
  )
}

export default function Checkouts() {
  const [scope, setScope] = useState('incomplete')
  const [review, setReview] = useState(false)
  const title = scope === 'recovered' ? 'Recovered checkouts will show here' : 'Abandoned checkouts will show here'
  return (
    <>
      <div className="orders-top">
        <h1>Abandoned checkouts</h1>
        <select className="ghost-select" aria-label="Checkout status" value={scope} onChange={e => setScope(e.target.value)}>
          <option value="incomplete">Incomplete</option>
          <option value="recovered">Recovered</option>
          <option value="all">All</option>
        </select>
      </div>
      <section className="panel empty-hero">
        <div>
          <h2>{title}</h2>
          <p>See when customers put an item in their cart but don't check out. You can also email customers a link to their cart.</p>
        </div>
        <CartMark />
      </section>
      <section className="panel recover">
        <h2>Recover sales with your abandoned checkout email</h2>
        <p>An automated email is already created for you. Take a moment to review the email and make any additional adjustments to the design, messaging, or recipient list.</p>
        <button type="button" className="ghost" onClick={() => setReview(true)}>Review email</button>
      </section>
      <a className="learn" href="https://help.shopify.com/en/manual/orders/abandoned-checkouts" target="_blank" rel="noreferrer">Learn more about abandoned checkouts</a>
      {review && (
        <Modal title="Abandoned checkout email" onClose={() => setReview(false)}>
          <div className="email">
            <p><span>Subject</span> You left something in your cart</p>
            <p>Hi there,</p>
            <p>You added items to your cart and didn't check out. They're still waiting — come back and finish your order.</p>
            <p className="email-btn">Return to cart</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="solid" onClick={() => setReview(false)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  )
}
