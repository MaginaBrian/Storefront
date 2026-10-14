export function Sheet({ title, action, columns, rows, empty, picked }) {
  return (
    <>
      <div className="page-head">
        <h1 className="title">{title}</h1>
        {action}
      </div>
      <div className="card">
        <table>
          <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows?.map(row => (
              <tr key={row.id ?? row.title} className={picked && picked(row) ? 'picked' : ''}>
                {columns.map(c => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </tr>
            ))}
            {rows && rows.length === 0 && <tr><td className="muted" colSpan={columns.length}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

export const Status = ({ value }) => <span className={`pill ${value}`}>{value}</span>

export function EmptyPane({ title, actions, heading, text, action, onAction, extra, learn, href, mark }) {
  return (
    <>
      <div className="orders-top">
        <h1>{title}</h1>
        <div className="orders-actions">{actions}</div>
      </div>
      <section className="panel empty-hero">
        {mark}
        <div>
          <h2>{heading}</h2>
          <p>{text}</p>
          <div className="orders-actions">
            {extra}
            {action && <button type="button" className="solid" onClick={onAction}>{action}</button>}
          </div>
        </div>
      </section>
      {learn && <a className="learn" href={href} target="_blank" rel="noreferrer">{learn}</a>}
    </>
  )
}
