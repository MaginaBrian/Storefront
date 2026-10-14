import { useApi } from '../lib/api.js'
import { Sheet, Status } from './ui.jsx'

export function Growth({ focus = {}, onOpen }) {
  const [rows] = useApi('/api/growth')
  return (
    <Sheet title="Growth" rows={rows} empty="No campaigns yet." picked={r => r.channel === focus.channel} columns={[
      { key: 'name', label: 'Campaign' },
      { key: 'channel', label: 'Channel', render: r => <button type="button" className="text-link" onClick={() => onOpen('orders', { channel: r.channel })}>{r.channel}</button> },
      { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      { key: 'reach', label: 'Reach', render: r => r.reach.toLocaleString() },
    ]} />
  )
}
