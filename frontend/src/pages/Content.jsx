import { useApi } from '../lib/api.js'
import { Sheet, Status } from './ui.jsx'

export function Content() {
  const [rows] = useApi('/api/content')
  return (
    <Sheet title="Content" rows={rows} empty="No pages yet." columns={[
      { key: 'title', label: 'Page' },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      { key: 'updated_at', label: 'Updated' },
    ]} />
  )
}
