import Checkouts from './Checkouts.jsx'
import DraftDetail from './DraftDetail.jsx'
import DraftsList from './DraftsList.jsx'
import OrderDetail from './OrderDetail.jsx'
import OrdersList from './OrdersList.jsx'

export default function OrdersSection({ view, onChanged, onOpen, focus }) {
  if (view === 'drafts' && focus?.draft) return <DraftDetail draftId={focus.draft} onOpen={onOpen} />
  if (view === 'drafts') return <DraftsList onOpen={onOpen} focus={focus} />
  if (view === 'checkouts') return <Checkouts />
  if (focus?.order) return <OrderDetail orderId={focus.order} onOpen={onOpen} onChanged={onChanged} />
  return <OrdersList onChanged={onChanged} onOpen={onOpen} focus={focus} />
}
