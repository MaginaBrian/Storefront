import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { request } from '../api/client.js'
import { useJson } from '../lib/api.js'
import { APPS, AREAS } from '../access.js'

function Permits({ selected, onChange, disabled }) {
  const toggle = key => {
    if (disabled) return
    onChange(selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key])
  }
  const group = (title, rows) => (
    <div className="settings-block">
      <h2>{title}</h2>
      <div className="permit-grid">
        {rows.map(([key, label, detail]) => (
          <label key={key} className="permit">
            <input type="checkbox" checked={selected.includes(key)} disabled={disabled} onChange={() => toggle(key)} />
            <span><strong>{label}</strong><small>{detail}</small></span>
          </label>
        ))}
      </div>
    </div>
  )
  return (
    <>
      {group('Permissions', AREAS)}
      {group('App permissions', APPS)}
    </>
  )
}

function RoleEditor({ role, onOpen, onSaved }) {
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [permissions, setPermissions] = useState(role?.permissions || ['home'])
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const managed = !!role?.managed
  const save = event => {
    event.preventDefault()
    const path = role ? `/api/roles/${role.id}` : '/api/roles'
    const body = role ? { action: 'update', name, description, permissions } : { name, description, permissions }
    request(path, { method: 'POST', body }).then(payload => {
      onSaved()
      onOpen('settings', { section: 'users', roles: '1', role: payload.id })
    }).catch(err => setError(err.message))
  }
  const act = action => request(`/api/roles/${role.id}`, { method: 'POST', body: { action } }).then(payload => {
    onSaved()
    if (payload.deleted) onOpen('settings', { section: 'users', roles: '1' })
    else onOpen('settings', { section: 'users', roles: '1', role: payload.id })
  }).catch(err => setError(err.message))
  return (
    <form className="settings-page" onSubmit={save}>
      <button type="button" className="text-link" onClick={() => onOpen('settings', { section: 'users', roles: '1' })}><ChevronLeft size={14} /> Roles</button>
      <div className="card-title">
        <h1>{role ? role.name : 'Add role'}</h1>
        {role && !managed && (
          <div className="orders-actions">
            <button type="button" className="ghost" onClick={() => act('duplicate')}>Duplicate</button>
            <button type="button" className="ghost" onClick={() => { if (!confirm) { setConfirm(true); return } act('delete') }}>{confirm ? 'Delete role' : 'Delete'}</button>
          </div>
        )}
      </div>
      {managed && <p className="settings-note">Piacì manages this role. You can assign it. The name and permissions stay as they are.</p>}
      {!managed && <p className="settings-note">This is a store role. Organization roles are for the Plus plan, and this store is a single shop.</p>}
      {error && <p className="form-error">{error}</p>}
      <label className="field">Name
        <input value={name} disabled={managed} onChange={e => setName(e.target.value)} />
      </label>
      <label className="field">Description
        <input value={description} disabled={managed} onChange={e => setDescription(e.target.value)} />
      </label>
      <p className="muted">Category: Store</p>
      <Permits selected={permissions} onChange={setPermissions} disabled={managed} />
      {!managed && <button type="submit" className="solid">Save</button>}
    </form>
  )
}

function Roles({ focus, onOpen }) {
  const [rows, reload] = useJson('/api/roles')
  if (focus.add === '1') return <RoleEditor onOpen={onOpen} onSaved={reload} />
  const picked = rows?.find(row => String(row.id) === String(focus.role))
  if (focus.role && rows && !picked) {
    return (
      <div className="settings-page">
        <h1>Role</h1>
        <p>This role is not in the store.</p>
      </div>
    )
  }
  if (focus.role) {
    if (!picked) return <p className="muted">Loading role…</p>
    return <RoleEditor key={picked.id} role={picked} onOpen={onOpen} onSaved={reload} />
  }
  return (
    <div className="settings-page">
      <div className="card-title">
        <h1>Roles</h1>
        <button type="button" className="solid" onClick={() => onOpen('settings', { section: 'users', add: '1', roles: '1' })}>Add role</button>
      </div>
      <p className="lead">A role bundles the parts of a sale a person may open. Products are what you sell, customers are who buys, discounts are the offer, orders record the purchase, markets shape the experience, and analytics shows the result.</p>
      <div className="settings-rows">
        {(rows || []).map(row => (
          <button type="button" key={row.id} className="settings-row" onClick={() => onOpen('settings', { section: 'users', role: row.id, roles: '1' })}>
            <span className="grow"><strong>{row.name}</strong><small>{row.managed ? 'Managed by Piacì' : 'Store role'} · {row.users} {row.users === 1 ? 'user' : 'users'}</small></span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UserDetail({ person, roles, onOpen, onSaved }) {
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [stores, setStores] = useState(false)
  const assigned = new Set((person.roles || []).map(role => role.id))
  const act = body => request(`/api/staff/${person.id}`, { method: 'POST', body }).then(() => {
    onSaved()
    setAdding(false)
    setStores(false)
  }).catch(err => setError(err.message))
  return (
    <div className="settings-page">
      <button type="button" className="text-link" onClick={() => onOpen('settings', { section: 'users' })}><ChevronLeft size={14} /> Users</button>
      <h1>{person.name}</h1>
      <p className="muted">{person.email}{person.owner ? ' · Store owner' : ''}</p>
      {error && <p className="form-error">{error}</p>}
      {person.owner && <p className="settings-note">The store owner has every permission. The Administrator role stays assigned, and Maison stays available.</p>}
      <section className="settings-block">
        <div className="card-title">
          <h2>Roles</h2>
          <button type="button" className="ghost" onClick={() => setAdding(value => !value)}>Add role</button>
        </div>
        <div className="settings-rows">
          {(person.roles || []).map(role => (
            <div key={role.id} className="settings-row">
              <span className="grow"><strong>{role.name}</strong><small>{role.managed ? 'Managed by Piacì' : role.description}</small></span>
              <button type="button" className="text-link" onClick={() => act({ action: 'remove', role: role.id })}>Remove</button>
            </div>
          ))}
          {(person.roles || []).length === 0 && <p className="settings-row">No role assigned. This user can open Home only when a role includes it.</p>}
        </div>
        {adding && (
          <div className="settings-rows">
            {(roles || []).filter(role => !assigned.has(role.id)).map(role => (
              <button type="button" key={role.id} className="settings-row" onClick={() => act({ action: 'assign', role: role.id })}>
                <span className="grow"><strong>{role.name}</strong><small>{role.description}</small></span>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="settings-block">
        <div className="card-title">
          <h2>Store access</h2>
          <button type="button" className="ghost" onClick={() => setStores(value => !value)}>Edit store access</button>
        </div>
        <p className="muted">{(person.stores || []).length ? person.stores.join(', ') : 'No store access'}</p>
        {stores && (
          <form className="detail-card" onSubmit={event => {
            event.preventDefault()
            const chosen = [...event.currentTarget.querySelectorAll('input:checked')].map(input => input.value)
            act({ action: 'stores', stores: chosen })
          }}>
            <label className="permit">
              <input type="checkbox" name="store" value="Maison" defaultChecked={(person.stores || []).includes('Maison')} />
              <span><strong>Maison</strong><small>The only store in this shop.</small></span>
            </label>
            <button type="submit" className="solid">Done</button>
          </form>
        )}
      </section>
    </div>
  )
}

export function UsersAdmin({ focus = {}, onOpen }) {
  const [people, reloadPeople] = useJson('/api/staff')
  const [roles, reloadRoles] = useJson('/api/roles')
  const reload = () => { reloadPeople(); reloadRoles() }
  if (focus.roles === '1' || focus.add === '1' || focus.role) return <Roles focus={focus} onOpen={onOpen} />
  const picked = (people || []).find(person => String(person.id) === String(focus.user))
  if (focus.user && people && !picked) {
    return <div className="settings-page"><h1>User</h1><p>This user is not in the store.</p></div>
  }
  if (picked) return <UserDetail person={picked} roles={roles} onOpen={onOpen} onSaved={reload} />
  return (
    <div className="settings-page">
      <div className="card-title">
        <h1>Users</h1>
        <button type="button" className="ghost" onClick={() => onOpen('settings', { section: 'users', roles: '1' })}>Roles</button>
      </div>
      <p className="lead">The store owner and anyone with the Administrator role can manage users. Other roles open only the areas they are given.</p>
      <div className="settings-rows">
        {(people || []).map(person => (
          <button type="button" key={person.id} className="settings-row" onClick={() => onOpen('settings', { section: 'users', user: person.id })}>
            <span className="grow">
              <strong>{person.name}</strong>
              <small>{person.email} · {(person.roles || []).map(role => role.name).join(', ') || 'No role'} · {(person.stores || []).join(', ') || 'No store'}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
