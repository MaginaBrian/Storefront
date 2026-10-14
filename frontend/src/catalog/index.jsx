import { Collections } from './Collections.jsx'
import { GiftCards } from './GiftCards.jsx'
import { Inventory } from './Inventory.jsx'
import { PurchaseOrders } from './PurchaseOrders.jsx'
import { Transfers } from './Transfers.jsx'

export default function CatalogSection({ view, focus, onOpen }) {
  if (view === 'collections') return <Collections focus={focus} onOpen={onOpen} />
  if (view === 'inventory') return <Inventory focus={focus} onOpen={onOpen} />
  if (view === 'purchase-orders') return <PurchaseOrders focus={focus} onOpen={onOpen} />
  if (view === 'transfers') return <Transfers focus={focus} onOpen={onOpen} />
  if (view === 'gift-cards') return <GiftCards focus={focus} onOpen={onOpen} />
  return null
}
