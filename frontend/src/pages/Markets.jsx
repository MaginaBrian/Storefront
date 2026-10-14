import { useApi } from '../lib/api.js'
import { Sheet, Status } from './ui.jsx'

export function Markets() {
  const [rows] = useApi('/api/markets')
  return (
    <Sheet title="Markets" rows={rows} empty="No markets yet." columns={[
      { key: 'name', label: 'Market' },
      { key: 'currency', label: 'Currency' },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
    ]} />
  )
}
