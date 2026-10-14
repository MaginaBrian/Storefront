import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'

const LINKS = {
  Home: ['home'],
  Catalog: ['products'],
  Contact: ['content', { page: 'Contact' }],
  Search: ['home'],
  Orders: ['orders'],
  Profile: ['customers'],
}

export function Menus({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/menus')
  const [open, setOpen] = useState(false)
  const [redirects, setRedirects] = useState(false)
  const [name, setName] = useState('')
  const [items, setItems] = useState('')
  const [error, setError] = useState('')
  const picked = (rows || []).find(row => String(row.id) === String(focus.menu))
  const save = event => {
    event.preventDefault()
    fetch('/api/menus', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not create menu')
      setOpen(false)
      setName('')
      setItems('')
      setError('')
      reload()
    }).catch(err => setError(err.message))
  }
  return (
    <>
      <div className="orders-top">
        <h1>Menus</h1>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => setRedirects(true)}>URL redirects</button>
          <button type="button" className="solid" onClick={() => setOpen(true)}>Create menu</button>
        </div>
      </div>
      {picked && (
        <section className="handoff">
          <div>
            <h2>{picked.name}</h2>
            <p>{picked.items}</p>
          </div>
          <button type="button" className="ghost" onClick={() => onOpen('menus')}>All menus</button>
        </section>
      )}
      <div className="sheet">
        <table>
          <thead><tr><th>Menu <ChevronDown size={12} className="sort-mark" /></th><th>Menu items</th></tr></thead>
          <tbody>
            {(rows || []).map(row => (
              <tr key={row.id} className="clickable" onClick={() => onOpen('menus', { menu: row.id })}>
                <td>{row.name}</td>
                <td onClick={e => e.stopPropagation()}>
                  {row.items.split(',').map(item => item.trim()).filter(Boolean).map((item, index, list) => {
                    const link = LINKS[item]
                    return (
                      <span key={item}>
                        {link
                          ? <button type="button" className="text-link" onClick={() => onOpen(link[0], link[1])}>{item}</button>
                          : item}
                        {index < list.length - 1 ? ', ' : ''}
                      </span>
                    )
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {redirects && (
        <Modal title="URL redirects" onClose={() => setRedirects(false)}>
          <form className="modal-form" onSubmit={event => event.preventDefault()}>
            <p>No redirects yet. Send an old path to a page in the store.</p>
            <label>From<input placeholder="/old-path" /></label>
            <label>To<input placeholder="/pages/contact" /></label>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setRedirects(false)}>Close</button>
            </div>
          </form>
        </Modal>
      )}
      {open && (
        <Modal title="Create menu" onClose={() => setOpen(false)}>
          <form className="modal-form" onSubmit={save}>
            <label>Name<input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
            <label>Items<input value={items} onChange={e => setItems(e.target.value)} placeholder="Home, Catalog" /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="solid">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
