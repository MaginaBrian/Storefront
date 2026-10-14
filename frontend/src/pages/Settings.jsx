import { useEffect, useState } from 'react'
import { useApi } from '../lib/api.js'

export function Settings() {
  const [rows, reload] = useApi('/api/settings')
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (rows) setForm(Object.fromEntries(rows.map(r => [r.key, r.value])))
  }, [rows])
  if (!form) return null
  const save = e => {
    e.preventDefault()
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => { if (!r.ok) throw new Error(); setSaved(true); reload() }).catch(() => setSaved(false))
  }
  return (
    <>
      <h1 className="title">Settings</h1>
      <form className="card settings" onSubmit={save}>
        {rows.map(r => (
          <label key={r.key}>{r.label}
            <input value={form[r.key] ?? ''} onChange={e => { setSaved(false); setForm(f => ({ ...f, [r.key]: e.target.value })) }} />
          </label>
        ))}
        <div className="modal-actions">
          <button type="submit" className="solid">Save</button>
          {saved && <span className="muted">Saved</span>}
        </div>
      </form>
    </>
  )
}
