import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    el.showModal()
    return () => { if (el.open) el.close() }
  }, [])
  return (
    <dialog ref={ref} className="modal" onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose() }}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </div>
      {children}
    </dialog>
  )
}
