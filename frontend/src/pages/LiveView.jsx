export function LiveView({ onOpen }) {
  return (
    <div className="analytics-page">
      <div className="orders-top"><h1>Live View</h1></div>
      <div className="analytics-grid three">
        <article className="chart-card">
          <h2>Visitors right now</h2>
          <strong className="chart-value">1</strong>
          <p>Desktop · Nairobi, Kenya</p>
        </article>
        <article className="chart-card">
          <h2>Landing page</h2>
          <button type="button" className="text-link" onClick={() => onOpen('products')}>/products_preview</button>
        </article>
        <article className="chart-card">
          <h2>Location</h2>
          <p className="loc-label">Kenya · Nairobi County · Nairobi</p>
          <div className="loc-bar"><i /><b>1</b></div>
        </article>
      </div>
      <article className="chart-card">
        <h2>Orders today</h2>
        <p className="flat-note">No orders yet today. Recent orders are from September.</p>
        <button type="button" className="ghost" onClick={() => onOpen('orders')}>View orders</button>
      </article>
    </div>
  )
}
