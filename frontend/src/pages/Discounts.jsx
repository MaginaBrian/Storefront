import { useApi } from '../lib/api.js'
import { Sheet, Status } from './ui.jsx'

export function Discounts() {
  const [rows] = useApi('/api/discounts')
  return (
    <Sheet title="Discounts" rows={rows} empty="No discounts yet." columns={[
      { key: 'code', label: 'Code' },
      { key: 'kind', label: 'Type' },
      { key: 'value', label: 'Value' },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      { key: 'uses', label: 'Uses' },
    ]} />
  )
}
