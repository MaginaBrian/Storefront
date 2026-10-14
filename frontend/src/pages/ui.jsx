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
