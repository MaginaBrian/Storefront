import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { money } from '../lib/money.js'

const SUGGESTED = ['Color', 'Size', 'Fabric']
const HINTS = { Color: 'Black, White, Navy', Size: 'S, M, L', Fabric: 'Cotton, Linen, Wool' }

function swatchFor(colors, value) {
  return (colors || []).find(entry => entry.name === value)?.swatch || ''
}

function duplicateTargets(options, variants, selected) {
  const rows = variants.filter(row => selected.includes(row.id))
  if (!rows.length) return []
  return options.flatMap((option, index) => {
    const shared = new Set(rows.map(row => row[`option${index + 1}`] || ''))
    if (shared.size !== 1) return []
    const rest = rows.map(row => options.map((_, position) => (position === index ? '' : row[`option${position + 1}`] || '')).join('\0'))
    if (new Set(rest).size !== rows.length) return []
    return [{ name: option.name, shared: [...shared][0] }]
  })
}

export default function ProductVariants({ options = [], variants = [], colors = [], act, onOpen }) {
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState([])
  const [open, setOpen] = useState(false)
  const [optionName, setOptionName] = useState('')
  const [optionValues, setOptionValues] = useState('')
  const [custom, setCustom] = useState(false)
  const [query, setQuery] = useState('')
  const [fromColors, setFromColors] = useState(false)
  const [pending, setPending] = useState({})
  const [selected, setSelected] = useState([])
  const [adding, setAdding] = useState(false)
  const [single, setSingle] = useState([])
  const [bulk, setBulk] = useState(null)
  const [bulkValue, setBulkValue] = useState('')
  const [entry, setEntry] = useState(null)
  const [entryName, setEntryName] = useState('')

  const run = extra => act('options', extra).then(body => {
    setError('')
    return body
  }).catch(err => {
    setError(err.message)
    return null
  })

  const addDraft = event => {
    event.preventDefault()
    const values = optionValues.split(',').map(part => part.trim()).filter(Boolean)
    const name = optionName.trim()
    if (!name || !values.length || draft.length >= 3) return
    if (draft.some(option => option.name.toLowerCase() === name.toLowerCase())) return
    setDraft(current => [...current, { name, values, source: fromColors ? 'color' : '' }])
    setOptionName('')
    setOptionValues('')
    setCustom(false)
    setFromColors(false)
    setQuery('')
    setOpen(false)
  }

  const saveDraft = () => {
    const count = draft.reduce((total, option) => total * option.values.length, 1)
    if (count > 2048) {
      setError('A product can have up to 2,048 variants.')
      return
    }
    run({ op: 'set', options: draft }).then(body => { if (body) setDraft([]) })
  }

  const toggle = id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const targets = duplicateTargets(options, variants, selected)
  const planned = draft.reduce((total, option) => total * option.values.length, draft.length ? 1 : 0)

  return (
    <section className="detail-card">
      <div className="card-title">
        <h2>Variants</h2>
        <span className="muted">{variants.length} {variants.length === 1 ? 'variant' : 'variants'}</span>
      </div>
      <p className="muted">Price, inventory, and shipping are set on each variant. A product can have up to 3 options and 2,048 variants.</p>
      {error && <p className="form-error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {options.length === 0 && (
        <>
          {draft.map(option => (
            <p key={option.name} className="pinned-field">
              {option.name}: {option.values.join(', ')}
              {option.source === 'color' && <span className="muted">Color entries</span>}
              <button type="button" className="icon-btn" aria-label={`Remove ${option.name}`} onClick={() => setDraft(current => current.filter(item => item.name !== option.name))}><X size={12} /></button>
            </p>
          ))}
          {planned > 0 && <p className="muted">Saving creates {planned} variants. The current quantity stays on the first one.</p>}
          {open && (optionName || custom) ? (
            <form className="tag-form" onSubmit={addDraft}>
              {custom ? <input aria-label="Option name" value={optionName} onChange={e => setOptionName(e.target.value)} placeholder="Option name" /> : <strong>{optionName}</strong>}
              <input aria-label="Option values" value={optionValues} onChange={e => setOptionValues(e.target.value)} placeholder={HINTS[optionName] || 'Values, separated by commas'} />
              <button type="submit" className="solid">Done</button>
            </form>
          ) : open ? (
            <div className="category-menu">
              <label className="category-search">
                <Search size={14} />
                <input aria-label="Search options" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
              </label>
              {colors.length > 0 && !draft.some(option => option.source === 'color') && (
                <>
                  <p className="muted">Category metafields</p>
                  <button type="button" onClick={() => { setOptionName('Color'); setCustom(false); setFromColors(true); setOptionValues(colors.map(item => item.name).join(', ')) }}>Color</button>
                </>
              )}
              <p className="muted">Recommended</p>
              {SUGGESTED.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()) && !draft.some(option => option.name === name)).map(name => (
                <button type="button" key={name} onClick={() => { setOptionName(name); setCustom(false); setFromColors(false); setOptionValues('') }}>{name}</button>
              ))}
              <button type="button" onClick={() => { setCustom(true); setOptionName(''); setFromColors(false) }}><Plus size={14} /> Create custom option</button>
            </div>
          ) : draft.length < 3 ? (
            <button type="button" className="text-link" onClick={() => { setOpen(true); setOptionName(''); setCustom(false); setQuery('') }}><Plus size={14} /> Add options like size or color</button>
          ) : <p className="muted">This product already has 3 options.</p>}
          {draft.length > 0 && <button type="button" className="solid" onClick={saveDraft}>Save variants</button>}
        </>
      )}

      {options.map(option => (
        <div key={option.name} className="option-block">
          <div className="card-title">
            <strong>{option.name}</strong>
            {option.source === 'color'
              ? <button type="button" className="text-link" onClick={() => run({ op: 'disconnect', name: option.name })}>Disconnect</button>
              : colors.length > 0 && <button type="button" className="text-link" onClick={() => run({ op: 'connect', name: option.name })}>Connect to Color</button>}
            <button type="button" className="text-link" onClick={() => run({ op: 'remove_option', name: option.name })}>Remove option</button>
          </div>
          {option.source === 'color' && <p className="muted">Connected to the Color category metafield. Renaming an entry updates every variant that uses it.</p>}
          <div className="option-values">
            {option.values.map(value => {
              const swatch = swatchFor(colors, value)
              const color = colors.find(item => item.name === value)
              return (
                <span key={value} className="option-value">
                  {swatch && <i className="swatch-dot" style={{ background: swatch }} />}
                  <input aria-label={`${option.name} ${value}`} defaultValue={value} key={`${option.name}-${value}`} onBlur={e => {
                    const next = e.target.value.trim()
                    if (next && next !== value) run({ op: 'rename_value', name: option.name, source: value, value: next })
                  }} />
                  {option.source === 'color' && color && (
                    <button type="button" className="text-link" onClick={() => { setEntry({ ...color, option: option.name }); setEntryName(color.name) }}>Edit</button>
                  )}
                  <button type="button" className="icon-btn" aria-label={`Remove ${value}`} onClick={() => run({ op: 'remove_value', name: option.name, value })}><X size={12} /></button>
                </span>
              )
            })}
          </div>
          {option.source === 'color' && colors.filter(item => !option.values.includes(item.name)).map(item => (
            <button type="button" key={item.id} className="text-link" onClick={() => run({ op: 'add_value', name: option.name, value: item.name })}><Plus size={12} /> {item.name}</button>
          ))}
          <form className="tag-form" onSubmit={event => {
            event.preventDefault()
            const value = (pending[option.name] || '').trim()
            if (!value) return
            run({ op: 'add_value', name: option.name, value }).then(body => { if (body) setPending(current => ({ ...current, [option.name]: '' })) })
          }}>
            <input aria-label={`Add another ${option.name}`} placeholder="Add another value" value={pending[option.name] || ''} onChange={e => setPending(current => ({ ...current, [option.name]: e.target.value }))} />
            <button type="submit" className="solid">Done</button>
          </form>
        </div>
      ))}

      {entry && (
        <form className="tag-form" onSubmit={event => {
          event.preventDefault()
          fetch(`/api/metaobjects/entries/${entry.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: entryName.trim(), kind: 'Color', swatch: entry.swatch }),
          }).then(async response => {
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'Could not update this color')
            setEntry(null)
            return act('options', { op: 'connect', name: entry.option })
          }).catch(err => setError(err.message))
        }}>
          <input aria-label="Color name" value={entryName} onChange={e => setEntryName(e.target.value)} />
          <button type="submit" className="solid">Save color</button>
        </form>
      )}

      {options.length > 0 && options.length < 3 && (
        open ? (
          <form className="tag-form" onSubmit={event => {
            event.preventDefault()
            const values = optionValues.split(',').map(part => part.trim()).filter(Boolean)
            if (!optionName.trim() || !values.length) return
            run({ op: 'add_option', option: { name: optionName.trim(), values, source: fromColors ? 'color' : '' } }).then(body => {
              if (!body) return
              setOpen(false)
              setOptionName('')
              setOptionValues('')
              setFromColors(false)
            })
          }}>
            <input aria-label="Option name" value={optionName} onChange={e => setOptionName(e.target.value)} placeholder="Option name" />
            <input aria-label="Option values" value={optionValues} onChange={e => setOptionValues(e.target.value)} placeholder="Values, separated by commas" />
            <button type="submit" className="solid">Done</button>
          </form>
        ) : <button type="button" className="text-link" onClick={() => { setOpen(true); setOptionName(''); setFromColors(false) }}><Plus size={14} /> Add another option</button>
      )}

      <table className="variant-table">
        <thead>
          <tr>
            <th className="check" />
            <th>Variant</th>
            <th>Price</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {variants.map(row => (
            <tr key={row.id}>
              <td className="check"><input type="checkbox" aria-label={`Select ${row.variant}`} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td>
              <td>
                <button type="button" className="text-link" onClick={() => onOpen('inventory', { item: row.id })}>{row.variant}</button>
              </td>
              <td>{money(row.price)}</td>
              <td>{row.available}</td>
            </tr>
          ))}
          {variants.length === 0 && <tr><td colSpan={4} className="muted">No variants yet.</td></tr>}
        </tbody>
      </table>

      <div className="orders-actions">
        {options.length > 0 && <button type="button" className="ghost" onClick={() => { setAdding(value => !value); setSingle(options.map(() => '')) }}>Add variant</button>}
        {targets.map(target => (
          <button type="button" key={target.name} className="ghost" onClick={() => { setBulk(target); setBulkValue('') }}>Duplicate in another {target.name}</button>
        ))}
      </div>

      {adding && (
        <form className="tag-form" onSubmit={event => {
          event.preventDefault()
          run({ op: 'add_variant', values: single }).then(body => { if (body) setAdding(false) })
        }}>
          {options.map((option, index) => (
            <label key={option.name} className="field">{option.name}
              <input aria-label={`New ${option.name}`} value={single[index] || ''} onChange={e => setSingle(current => current.map((item, position) => position === index ? e.target.value : item))} />
            </label>
          ))}
          <p className="muted">At least one value has to be new. This creates one variant, not every combination.</p>
          <button type="submit" className="solid">Save</button>
        </form>
      )}

      {bulk && (
        <form className="tag-form" onSubmit={event => {
          event.preventDefault()
          run({ op: 'duplicate', ids: selected, name: bulk.name, value: bulkValue }).then(result => {
            if (!result) return
            setBulk(null)
            setSelected([])
            if (result.skipped?.length) setNotice(`Skipped ${result.skipped.join(', ')} because those variants already exist.`)
          })
        }}>
          <p className="muted">Copies price, quantity, SKU, barcode, and location from the selected {bulk.shared} variants.</p>
          <input aria-label={`New ${bulk.name}`} value={bulkValue} placeholder={`New ${bulk.name}`} onChange={e => setBulkValue(e.target.value)} />
          <button type="submit" className="solid">Duplicate</button>
        </form>
      )}
    </section>
  )
}
