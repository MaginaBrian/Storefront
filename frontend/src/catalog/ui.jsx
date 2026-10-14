import { Search } from 'lucide-react'

export function Toolbar({ label, value, onChange, extra }) {
  return (
    <div className="toolbar">
      <select aria-label={label} defaultValue="all"><option value="all">All</option></select>
      <label className="finder"><Search size={15} /><input placeholder="Search and filter" value={value} onChange={e => onChange(e.target.value)} /></label>
      {extra}
    </div>
  )
}

export function FormModal({ title, onClose, children }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <form className="modal-form card pop" onClick={e => e.stopPropagation()} onSubmit={children.onSubmit}>
        <h2>{title}</h2>
        {children.fields}
        {children.error && <p className="form-error">{children.error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="solid">Save</button>
        </div>
      </form>
    </div>
  )
}

export function EmptyCatalog({ title, action, onAction, heading, text, learn, href, mark }) {
  return (
    <>
      <div className="orders-top">
        <h1>{title}</h1>
        {action}
      </div>
      <div className="sheet">
        <Toolbar label={`Filter ${title}`} value="" onChange={() => {}} />
      </div>
      <section className="panel empty-hero catalog-empty">
        {mark}
        <div>
          <h2>{heading}</h2>
          <p>{text}</p>
          <button type="button" className="solid" onClick={onAction}>{onAction && heading.startsWith('Manage') ? 'Create purchase order' : onAction && heading.startsWith('Move') ? 'Create transfer' : 'Continue'}</button>
        </div>
      </section>
      <a className="learn" href={href} target="_blank" rel="noreferrer">{learn}</a>
    </>
  )
}

export function PoMark() {
  return (
    <svg className="catalog-mark" viewBox="0 0 120 90" aria-hidden="true">
      <circle cx="78" cy="46" r="28" fill="#f6d7a8" />
      <rect x="34" y="16" width="46" height="58" rx="6" fill="#fff" stroke="#d9dbe7" />
      <rect x="42" y="28" width="22" height="14" rx="3" fill="#7ec8c3" />
      <rect x="42" y="46" width="22" height="14" rx="3" fill="#8aa0e8" />
    </svg>
  )
}

export function TransferMark() {
  return (
    <svg className="catalog-mark" viewBox="0 0 140 80" aria-hidden="true">
      <rect x="8" y="16" width="44" height="48" rx="8" fill="#fff" stroke="#d9dbe7" />
      <rect x="88" y="16" width="44" height="48" rx="8" fill="#fff" stroke="#d9dbe7" />
      <path d="M58 40h24" stroke="#1f9d55" strokeWidth="4" />
      <path d="M76 32l10 8-10 8" fill="#1f9d55" />
      <text x="30" y="44" textAnchor="middle" fontSize="12" fill="#6a6e86">6</text>
      <text x="110" y="44" textAnchor="middle" fontSize="12" fill="#6a6e86">4</text>
    </svg>
  )
}

export function GiftMark() {
  return (
    <svg className="catalog-mark" viewBox="0 0 90 90" aria-hidden="true">
      <circle cx="45" cy="45" r="36" fill="#d8efef" />
      <rect x="24" y="34" width="42" height="28" rx="4" fill="#1f8a8a" />
      <path d="M45 34v28M24 46h42" stroke="#fff" strokeWidth="3" />
      <path d="M45 34c-6-10-16-8-16 0s10 0 16 0zm0 0c6-10 16-8 16 0s-10 0-16 0z" fill="#147070" />
    </svg>
  )
}
