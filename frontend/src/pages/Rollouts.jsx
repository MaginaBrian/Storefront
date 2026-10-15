import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from '../components/Modal.jsx'
import { useJson } from '../lib/api.js'
import { EmptyPane, Status } from './ui.jsx'

function RolloutMark() {
  return (
    <svg className="empty-mark" viewBox="0 0 140 100" aria-hidden="true">
      <circle cx="70" cy="28" r="10" fill="#e7eef8" stroke="#c5d4ea" />
      <rect x="28" y="52" width="34" height="28" rx="4" fill="#fff" stroke="#d5e0ea" />
      <rect x="78" y="52" width="34" height="28" rx="4" fill="#fff" stroke="#d5e0ea" />
      <path d="M70 38v8M45 52v-6h50v6" stroke="#c5d4ea" fill="none" />
    </svg>
  )
}

function blank() {
  return {
    name: 'New rollout',
    note: '',
    starts: '',
    ends: '',
    showEnd: false,
    changes: [],
    split: 'None',
    allocation: 'All eligible visitors',
    markets: [],
  }
}

function parseConfig(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function Reach({ portion }) {
  const radius = 28
  const length = 2 * Math.PI * radius
  const shown = portion == null ? length : length * portion
  return (
    <div className="reach">
      <svg viewBox="0 0 72 72" aria-label="Reached">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#d7e9fb" strokeWidth="8" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#2f9bff" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${shown} ${length}`} transform="rotate(-90 36 36)" />
      </svg>
      <p><i /> Reached</p>
    </div>
  )
}

function RolloutEditor({ rolloutId, onOpen, onSaved }) {
  const [discounts] = useJson('/api/discounts')
  const [catalogs] = useJson('/api/market-catalogs')
  const [markets] = useJson('/api/markets')
  const [form, setForm] = useState(blank)
  const [notesOpen, setNotesOpen] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
  const [marketsOpen, setMarketsOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const patch = next => setForm(current => ({ ...current, ...next }))
  useEffect(() => {
    if (!rolloutId) return
    fetch(`/api/rollouts/${rolloutId}`).then(r => r.json()).then(row => {
      if (row.error) { setError(row.error); return }
      const config = parseConfig(row.config)
      setForm({ ...blank(), ...config, name: row.name, note: row.note || '' })
      if (row.note) setNotesOpen(true)
    }).catch(() => setError('Could not load this rollout.'))
  }, [rolloutId])
  const marketNames = (markets || []).map(row => row.name)
  const splitPortion = form.split === '10%' ? 0.1 : form.split === '25%' ? 0.25 : form.split === '50%' ? 0.5 : null
  const portion = splitPortion != null ? splitPortion : (form.markets.length && marketNames.length ? form.markets.length / marketNames.length : null)
  const toggle = (list, name) => list.includes(name) ? list.filter(item => item !== name) : [...list, name]
  const launch = event => {
    event.preventDefault()
    setBusy(true)
    const body = {
      name: form.name.trim() || 'New rollout',
      note: form.note,
      status: 'scheduled',
      config: form,
    }
    const request = rolloutId
      ? fetch(`/api/rollouts/${rolloutId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : fetch('/api/rollouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    request.then(async response => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not launch this rollout')
      onSaved()
      onOpen('rollouts', { rollout: payload.id })
    }).catch(err => setError(err.message)).finally(() => setBusy(false))
  }
  const changeOptions = [
    'Online Store theme',
    'Checkout',
    ...(discounts || []).map(row => `Discount · ${row.code}`),
    ...(catalogs || []).map(row => `Catalog · ${row.title}`),
  ]
  return (
    <form className="order-page" onSubmit={event => event.preventDefault()}>
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('rollouts')}>Rollouts</button>
        <span>/</span>
        <span>{rolloutId ? form.name : 'New rollout'}</span>
        <span className="pill draft">Draft</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid">
        <div>
          <section className="detail-card">
            <label>Rollout name
              <span className="name-launch">
                <input value={form.name} onChange={e => patch({ name: e.target.value })} />
                <button type="button" className="ghost" disabled={busy} onClick={launch}>{busy ? 'Launching…' : 'Launch'}</button>
              </span>
            </label>
          </section>
          <section className="detail-card">
            <h2>Scheduling</h2>
            <div className="schedule-row">
              <span>Changes publish</span>
              <input type="date" aria-label="Start date" value={form.starts} onChange={e => patch({ starts: e.target.value })} />
              {!form.showEnd && <button type="button" className="text-link" onClick={() => patch({ showEnd: true })}>+ Set end date</button>}
            </div>
            {form.showEnd && <input type="date" aria-label="End date" value={form.ends} onChange={e => patch({ ends: e.target.value })} />}
            <p className="muted">Changes are permanently merged into the store.</p>
          </section>
          <section className="detail-card">
            <h2>Changes</h2>
            <div className="change-well">
              {form.changes.length === 0 && <p>Prepare changes for a launch or sales event</p>}
              {form.changes.length > 0 && (
                <p className="chip-row">
                  {form.changes.map(item => (
                    <button type="button" className="quiet-tag" key={item} onClick={() => patch({ changes: form.changes.filter(name => name !== item) })}>{item}</button>
                  ))}
                </p>
              )}
              <button type="button" className="ghost" onClick={() => setChangesOpen(true)}>Add changes</button>
            </div>
          </section>
          <section className="detail-card">
            <h2>Audience</h2>
            <div className="audience">
              <div>
                <div className="audience-row">
                  <span>Traffic split</span>
                  <select aria-label="Traffic split" value={form.split} onChange={e => patch({ split: e.target.value })}>
                    <option>None</option>
                    <option>10%</option>
                    <option>25%</option>
                    <option>50%</option>
                  </select>
                </div>
                <div className="audience-row">
                  <span>Traffic allocation</span>
                  <select aria-label="Traffic allocation" value={form.allocation} onChange={e => patch({ allocation: e.target.value })}>
                    <option>All eligible visitors</option>
                    <option>New visitors</option>
                    <option>Returning visitors</option>
                  </select>
                </div>
                <div className="audience-row">
                  <span>Eligibility</span>
                  <button type="button" className="text-link" onClick={() => setMarketsOpen(open => !open)}>{form.markets.length} {form.markets.length === 1 ? 'market' : 'markets'}</button>
                </div>
                {marketsOpen && (
                  <div className="picker">
                    {marketNames.map(name => (
                      <label key={name} className="choice"><input type="checkbox" checked={form.markets.includes(name)} onChange={() => patch({ markets: toggle(form.markets, name) })} />{name}</label>
                    ))}
                  </div>
                )}
              </div>
              <Reach portion={portion} />
            </div>
          </section>
        </div>
        <aside className="order-side">
          <section className="detail-card">
            <div className="between">
              <h2>Notes</h2>
              <button type="button" className="icon-btn" aria-label="Edit notes" onClick={() => setNotesOpen(open => !open)}><Pencil size={14} /></button>
            </div>
            {notesOpen
              ? <textarea aria-label="Notes" rows={4} value={form.note} onChange={e => patch({ note: e.target.value })} />
              : <p className="muted">{form.note || 'No notes'}</p>}
          </section>
        </aside>
      </div>
      {changesOpen && (
        <Modal title="Add changes" onClose={() => setChangesOpen(false)}>
          <div className="modal-form browse-list">
            {changeOptions.map(item => (
              <label key={item} className="choice">
                <input type="checkbox" checked={form.changes.includes(item)} onChange={() => patch({ changes: toggle(form.changes, item) })} />
                {item}
              </label>
            ))}
            {changeOptions.length === 0 && <p className="muted">No store changes to attach yet.</p>}
          </div>
          <div className="modal-actions"><button type="button" className="solid" onClick={() => setChangesOpen(false)}>Done</button></div>
        </Modal>
      )}
    </form>
  )
}

export function Rollouts({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/rollouts')
  if (focus.create === '1') return <RolloutEditor onOpen={onOpen} onSaved={reload} />
  if (focus.rollout) return <RolloutEditor key={focus.rollout} rolloutId={focus.rollout} onOpen={onOpen} onSaved={reload} />
  const create = <button type="button" className="solid" onClick={() => onOpen('rollouts', { create: '1' })}>Create rollout</button>
  if (!rows) return <p className="muted">Loading rollouts…</p>
  return (
    <>
      {rows.length === 0 ? (
        <EmptyPane
          title="Rollouts"
          actions={create}
          heading="Schedule changes to your store"
          text="Prepare changes to themes, discounts, catalogs, and checkout for upcoming launches, temporary events, or A/B tests."
          action="Create rollout"
          onAction={() => onOpen('rollouts', { create: '1' })}
          learn="Learn more about rollouts"
          href="https://help.shopify.com/en/manual/markets/rollouts"
          mark={<RolloutMark />}
        />
      ) : (
        <>
          <div className="orders-top"><h1>Rollouts</h1>{create}</div>
          <div className="sheet">
            <table>
              <thead><tr><th>Rollout</th><th>Status</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="clickable" onClick={() => onOpen('rollouts', { rollout: row.id })}>
                    <td><button type="button" className="text-link">{row.name}</button></td>
                    <td><Status value={row.status || 'draft'} /></td>
                    <td>{row.note || '—'}</td>
                    <td>{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
