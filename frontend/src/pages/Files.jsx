import { useState } from 'react'
import { Link2, Plus } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'
import { EmptyPane } from './ui.jsx'

function FilesMark() {
  return (
    <svg className="empty-mark" viewBox="0 0 140 100" aria-hidden="true">
      <circle cx="70" cy="48" r="34" fill="#eef3f6" />
      <rect x="48" y="34" width="36" height="28" rx="4" fill="#fff" stroke="#d5dde6" />
      <rect x="62" y="22" width="28" height="22" rx="4" fill="#8ec5c0" />
      <rect x="78" y="18" width="22" height="16" rx="3" fill="#f3d2d2" />
    </svg>
  )
}

export function Files() {
  const [rows, reload] = useJson('/api/files')
  const [mode, setMode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const save = event => {
    event.preventDefault()
    fetch('/api/files', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind: mode === 'url' ? 'URL' : 'File', source: mode === 'url' ? name : '' }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not add file')
      setMode('')
      setName('')
      setError('')
      reload()
    }).catch(err => setError(err.message))
  }
  const actions = (
    <>
      <button type="button" className="ghost" onClick={() => setMode('url')}><Link2 size={14} /> Upload from URL</button>
      <button type="button" className="solid" onClick={() => setMode('file')}><Plus size={14} /> Files</button>
    </>
  )
  if (!rows) return <p className="muted">Loading files…</p>
  return (
    <>
      {rows.length === 0 ? (
        <EmptyPane
          title="Files"
          actions={actions}
          heading="Upload and manage your files"
          text="Files can be images, videos, documents, and more."
          action="Upload files"
          onAction={() => setMode('file')}
          learn="Learn more about files"
          href="https://help.shopify.com/en/manual/shopify-admin/productivity-tools/file-uploads"
          mark={<FilesMark />}
        />
      ) : (
        <>
          <div className="orders-top"><h1>Files</h1><div className="orders-actions">{actions}</div></div>
          <div className="sheet">
            <table>
              <thead><tr><th>File</th><th>Type</th><th>Source</th><th>Added</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}><td>{row.name}</td><td>{row.kind}</td><td>{row.source || '—'}</td><td>{row.created_at}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {mode && (
        <Modal title={mode === 'url' ? 'Upload from URL' : 'Upload files'} onClose={() => setMode('')}>
          <form className="modal-form" onSubmit={save}>
            <label>{mode === 'url' ? 'File URL' : 'File name'}
              <input value={name} onChange={e => setName(e.target.value)} placeholder={mode === 'url' ? 'https://' : 'lookbook.jpg'} autoFocus />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setMode('')}>Cancel</button>
              <button type="submit" className="solid">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
