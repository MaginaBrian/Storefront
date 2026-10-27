import { useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Check, ChevronDown, ChevronLeft, ChevronRight, Image, Italic, Link2, List, Plus, Search, Smile, Underline, X } from 'lucide-react'
import { useJson } from '../lib/api.js'
import { money } from '../lib/money.js'

const MAJORS = ['Animals & Pet Supplies', 'Apparel & Accessories', 'Arts & Entertainment', 'Baby & Toddler', 'Business & Industrial', 'Cameras & Optics', 'Electronics', 'Food, Beverages & Tobacco', 'Furniture', 'Hardware', 'Religious & Ceremonial', 'Software', 'Sporting Goods', 'Toys & Games', 'Vehicles & Parts', 'Gift Cards', 'Uncategorized', 'Services', 'Product Add-Ons', 'Bundles']
const CLOTHING = ['Activewear', 'Dresses', 'One-Pieces', 'Outerwear', 'Outfit Sets', 'Pants', 'Shorts', 'Skirts', 'Skorts', 'Sleepwear & Loungewear', 'Suits', 'Swimwear', 'Traditional & Ceremonial Clothing', 'Wedding & Bridal Party Dresses', 'Lingerie', "Men's Undergarments", 'Socks', 'Maternity Clothing', 'Clothing Tops', 'Uniforms & Workwear', "Baby & Children's Clothing"]
const VARIANT_OPTIONS = ['Color', 'Size', 'Fabric']
const VARIANT_HINTS = { Color: 'Black, White, Navy', Size: 'XS, S, M, L, XL', Fabric: 'Cotton, Linen, Wool' }
const TYPES = ['Shirt', 'Bag', 'Accessory', 'Vest']

function cents(value) {
  const n = Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function Switch({ on, label, onClick }) {
  return (
    <button type="button" className={`switch ${on ? 'on' : ''}`} aria-pressed={on} aria-label={label} onClick={onClick}>
      <i />
    </button>
  )
}

export default function AddProduct({ onOpen, gift = false }) {
  const [collections] = useJson('/api/collections')
  const [library, setLibrary] = useState(null)
  const [title, setTitle] = useState(gift ? 'Gift card' : '')
  const [description, setDescription] = useState('')
  const [media, setMedia] = useState('')
  const [category, setCategory] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [categoryLevel, setCategoryLevel] = useState('major')
  const [status, setStatus] = useState('active')
  const [channels, setChannels] = useState(true)
  const [productType, setProductType] = useState('')
  const [vendor, setVendor] = useState('')
  const [chosen, setChosen] = useState([])
  const [picking, setPicking] = useState(false)
  const [tags, setTags] = useState([])
  const [tag, setTag] = useState('')
  const [tagging, setTagging] = useState(false)
  const [theme, setTheme] = useState('Default product')
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [chargeTax, setChargeTax] = useState(true)
  const [cost, setCost] = useState('')
  const [priceOpen, setPriceOpen] = useState(false)
  const [tracked, setTracked] = useState(true)
  const [quantity, setQuantity] = useState('0')
  const [skuOpen, setSkuOpen] = useState(false)
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [continueSelling, setContinueSelling] = useState(false)
  const [options, setOptions] = useState([])
  const [optionOpen, setOptionOpen] = useState(false)
  const [optionQuery, setOptionQuery] = useState('')
  const [optionName, setOptionName] = useState('')
  const [customOption, setCustomOption] = useState(false)
  const [optionValues, setOptionValues] = useState('')
  const [fields, setFields] = useState([])
  const [defining, setDefining] = useState(false)
  const [definition, setDefinition] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const descRef = useRef(null)

  const dirty = useMemo(() => Boolean(
    title.trim() !== (gift ? 'Gift card' : '') || description || media || category || productType || vendor || chosen.length || tags.length
    || price || compareAt || unitPrice || cost || sku || barcode || options.length || fields.length
    || quantity !== '0' || !tracked || !chargeTax || continueSelling || !channels
    || theme !== 'Default product' || status !== 'active',
  ), [gift, title, description, media, category, productType, vendor, chosen, tags, price, compareAt, unitPrice, cost, sku, barcode, options, fields, quantity, tracked, chargeTax, continueSelling, channels, theme, status])

  useEffect(() => { setError('') }, [title, price])

  const wrap = (before, after = before) => {
    const el = descRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = `${description.slice(0, start)}${before}${description.slice(start, end)}${after}${description.slice(end)}`
    setDescription(next)
  }

  const addOption = event => {
    event.preventDefault()
    const values = optionValues.split(',').map(part => part.trim()).filter(Boolean)
    if (!optionName.trim() || !values.length) return
    setOptions(current => current.some(option => option.name === optionName.trim()) ? current : [...current, { name: optionName.trim(), values }])
    setOptionValues('')
    setOptionName('')
    setCustomOption(false)
    setOptionQuery('')
    setOptionOpen(false)
  }

  const save = event => {
    event.preventDefault()
    const priceCents = price.trim() ? cents(price) : 0
    const stock = Number(quantity)
    if (!title.trim()) { setError('Enter a title.'); return }
    if (priceCents == null || !Number.isInteger(stock) || stock < 0) { setError('Enter a valid price and quantity.'); return }
    setBusy(true)
    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description,
        status,
        category,
        product_type: productType,
        vendor,
        media,
        price: priceCents,
        stock,
        tags,
        fields,
        collections: chosen,
        extra: {
          compare_at: compareAt.trim() ? cents(compareAt) : 0,
          unit_price: unitPrice.trim(),
          charge_tax: chargeTax,
          cost: cost.trim() ? cents(cost) : 0,
          sku,
          barcode,
          tracked,
          continue_selling: continueSelling,
          channels,
          theme,
          options,
          variant: options[0]?.values?.[0] || 'Default',
        },
      }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not save')
      onOpen('products', { product: body.title })
    }).catch(err => setError(err.message)).finally(() => setBusy(false))
  }

  const listing = title.trim() || description.trim()
  const priceLabel = price.trim() && cents(price) != null ? money(cents(price)) : ''

  return (
    <form className="order-page" onSubmit={save}>
      <div className="create-bar">
        <div className="order-title">
          <button type="button" className="icon-btn" aria-label="Back to products" onClick={() => onOpen('products')}><ChevronLeft size={18} /></button>
          <div>
            <div className="crumb"><button type="button" className="text-link" onClick={() => onOpen('products')}>Products</button> <span className="muted">/</span> Add product</div>
            <h1>Add product</h1>
          </div>
        </div>
        <div className="create-actions">
          {dirty && <span className="unsaved">Unsaved changes</span>}
          <button type="button" className="ghost" disabled={!dirty || busy} onClick={() => onOpen('products')}>Discard</button>
          <button type="submit" className="solid" disabled={busy}>Save</button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="order-grid">
        <div>
          <section className="detail-card">
            <label className="field">Title
              <input value={title} autoFocus placeholder="Short sleeve t-shirt" onChange={e => setTitle(e.target.value)} />
            </label>
            <label className="field">Description
              <div className="editor">
                <div className="editor-bar">
                  <button type="button" aria-label="Paragraph"><span className="type-mark">T</span> Paragraph <ChevronDown size={12} /></button>
                  <button type="button" aria-label="Bold" onClick={() => wrap('**')}><Bold size={14} /></button>
                  <button type="button" aria-label="Italic" onClick={() => wrap('_')}><Italic size={14} /></button>
                  <button type="button" aria-label="Underline" onClick={() => wrap('<u>', '</u>')}><Underline size={14} /></button>
                  <button type="button" aria-label="Link" onClick={() => wrap('[', '](https://)')}><Link2 size={14} /></button>
                  <button type="button" aria-label="Image" onClick={() => wrap('![', '](image)')}><Image size={14} /></button>
                  <button type="button" aria-label="List" onClick={() => wrap('\n- ')}><List size={14} /></button>
                  <button type="button" aria-label="Emoji" onClick={() => wrap(':)')}><Smile size={14} /></button>
                </div>
                <textarea ref={descRef} value={description} rows={6} onChange={e => setDescription(e.target.value)} />
              </div>
            </label>
          </section>

          <section className="detail-card">
            <h2>Media</h2>
            <div className="media-drop">
              {media ? <p>{media} <button type="button" className="text-link" onClick={() => setMedia('')}>Remove</button></p> : <p className="muted">Accepts images, videos, or 3D models</p>}
              <div className="orders-actions" style={{ justifyContent: 'center' }}>
                <label className="ghost file-btn">Upload new
                  <input type="file" accept="image/*,video/*,.glb,.gltf" onChange={e => { const file = e.target.files?.[0]; if (file) setMedia(file.name) }} />
                </label>
                <button type="button" className="text-link" onClick={() => {
                  if (library) { setLibrary(null); return }
                  fetch('/api/products').then(r => r.json()).then(rows => setLibrary(rows.filter(row => row.media)))
                }}>Select existing</button>
              </div>
              {library && (
                <div className="library">
                  {library.length === 0 && <p className="muted">No media in the library yet.</p>}
                  {library.map(item => (
                    <button type="button" key={item.id} onClick={() => { setMedia(item.media); setLibrary(null) }}>{item.title} · {item.media}</button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="detail-card">
            <div className="field category-picker">
              <span>Category</span>
              <button type="button" className="category-input" onClick={() => { setCategoryOpen(open => !open); if (CLOTHING.includes(category)) setCategoryLevel('clothing') }}>
                <span className={category ? '' : 'muted'}>{category ? (CLOTHING.includes(category) ? `Clothing / ${category}` : category) : 'Choose a product category'}</span>
                <ChevronDown size={14} />
              </button>
              {categoryOpen && (
                <div className="category-menu">
                  <label className="category-search">
                    <Search size={14} />
                    <input aria-label="Search categories" placeholder="Search categories" value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)} />
                  </label>
                  {categoryQuery.trim() ? (
                    <>
                      {MAJORS.filter(item => item.toLowerCase().includes(categoryQuery.trim().toLowerCase())).map(item => (
                        <button type="button" key={item} className={category === item ? 'on' : ''} onClick={() => item === 'Apparel & Accessories' ? setCategoryLevel('apparel') : setCategory(item)}>
                          <span>{category === item && <Check size={14} />} {item}</span>
                          {item === 'Apparel & Accessories' && <ChevronRight size={14} />}
                        </button>
                      ))}
                      {CLOTHING.filter(item => item.toLowerCase().includes(categoryQuery.trim().toLowerCase())).map(item => (
                        <button type="button" key={item} className={category === item ? 'on' : ''} onClick={() => setCategory(item)}>
                          <span>{category === item && <Check size={14} />} Clothing / {item}</span>
                        </button>
                      ))}
                    </>
                  ) : categoryLevel === 'clothing' ? (
                    <>
                      <button type="button" onClick={() => setCategoryLevel('apparel')}><ChevronLeft size={14} /> Back to Apparel & Accessories</button>
                      <p className="category-major"><Check size={14} /> Clothing</p>
                      {CLOTHING.map(item => (
                        <button type="button" key={item} className={category === item ? 'on inside' : 'inside'} onClick={() => setCategory(item)}>
                          <span>{category === item && <Check size={14} />} {item}</span>
                        </button>
                      ))}
                    </>
                  ) : categoryLevel === 'apparel' ? (
                    <>
                      <button type="button" onClick={() => setCategoryLevel('major')}><ChevronLeft size={14} /> Back</button>
                      <button type="button" onClick={() => setCategoryLevel('clothing')}>
                        <span>Clothing</span>
                        <ChevronRight size={14} />
                      </button>
                    </>
                  ) : MAJORS.map(item => (
                    <button type="button" key={item} className={category === item ? 'on' : ''} onClick={() => item === 'Apparel & Accessories' ? setCategoryLevel('apparel') : setCategory(item)}>
                      <span>{category === item && <Check size={14} />} {item}</span>
                      {item === 'Apparel & Accessories' && <ChevronRight size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="muted">Determines tax rates and adds metafields to improve search, filters, and cross-channel sales.</p>
          </section>

          <section className="detail-card">
            <label className="field">Price
              <input inputMode="decimal" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
            </label>
            <button type="button" className="summary-row" onClick={() => setPriceOpen(o => !o)}>
              <span>Compare-at</span>
              <span>Unit price</span>
              <span>Charge tax {chargeTax ? 'Yes' : 'No'}</span>
              <span>Cost per item</span>
              <ChevronDown size={14} />
            </button>
            {priceOpen && (
              <div className="price-grid">
                <label className="field">Compare-at<input inputMode="decimal" placeholder="0.00" value={compareAt} onChange={e => setCompareAt(e.target.value)} /></label>
                <label className="field">Unit price<input value={unitPrice} placeholder="0.00 / item" onChange={e => setUnitPrice(e.target.value)} /></label>
                <label className="field check-line">Charge tax
                  <Switch on={chargeTax} label="Charge tax" onClick={() => setChargeTax(v => !v)} />
                </label>
                <label className="field">Cost per item<input inputMode="decimal" placeholder="0.00" value={cost} onChange={e => setCost(e.target.value)} /></label>
              </div>
            )}
          </section>

          <section className="detail-card">
            <div className="card-title">
              <h2>Inventory</h2>
              <span className="card-tools">Inventory tracked <Switch on={tracked} label="Inventory tracked" onClick={() => setTracked(v => !v)} /></span>
            </div>
            <table className="qty-table">
              <thead><tr><th>Quantity</th><th>Quantity</th></tr></thead>
              <tbody><tr>
                <td>Nairobi</td>
                <td><input inputMode="numeric" aria-label="Quantity in Nairobi" value={quantity} onChange={e => setQuantity(e.target.value)} /></td>
              </tr></tbody>
            </table>
            <button type="button" className="summary-row" onClick={() => setSkuOpen(o => !o)}>
              <span>SKU</span>
              <span>Barcodes</span>
              <span>Sell when out of stock {continueSelling ? 'On' : 'Off'}</span>
              <ChevronDown size={14} />
            </button>
            {skuOpen && (
              <div className="price-grid">
                <label className="field">SKU<input value={sku} onChange={e => setSku(e.target.value)} /></label>
                <label className="field">Barcode<input value={barcode} onChange={e => setBarcode(e.target.value)} /></label>
                <label className="field check-line">Sell when out of stock
                  <Switch on={continueSelling} label="Sell when out of stock" onClick={() => setContinueSelling(v => !v)} />
                </label>
              </div>
            )}
          </section>

          <section className="detail-card">
            <h2>Variants</h2>
            {options.map(option => (
              <p key={option.name} className="pinned-field">{option.name}: {option.values.join(', ')}
                <button type="button" className="icon-btn" aria-label={`Remove ${option.name}`} onClick={() => setOptions(current => current.filter(item => item.name !== option.name))}><X size={12} /></button>
              </p>
            ))}
            {optionOpen && (optionName || customOption) ? (
              <div className="tag-form">
                {customOption
                  ? <input aria-label="Option name" value={optionName} onChange={e => setOptionName(e.target.value)} placeholder="Option name" />
                  : <strong>{optionName}</strong>}
                <input aria-label="Option values" value={optionValues} onChange={e => setOptionValues(e.target.value)} placeholder={VARIANT_HINTS[optionName] || 'Values, separated by commas'} />
                <button type="button" className="solid" onClick={addOption}>Done</button>
              </div>
            ) : optionOpen ? (
              <div className="category-menu">
                <label className="category-search">
                  <Search size={14} />
                  <input aria-label="Search options" placeholder="Search" value={optionQuery} onChange={e => setOptionQuery(e.target.value)} />
                </label>
                <p className="muted">Recommended</p>
                {VARIANT_OPTIONS.filter(name => name.toLowerCase().includes(optionQuery.trim().toLowerCase()) && !options.some(option => option.name === name)).map(name => (
                  <button type="button" key={name} onClick={() => { setOptionName(name); setCustomOption(false) }}>{name}</button>
                ))}
                <button type="button" onClick={() => { setCustomOption(true); setOptionName('') }}><Plus size={14} /> Create custom option</button>
              </div>
            ) : (
              <button type="button" className="text-link" onClick={() => { setOptionOpen(true); setOptionName(''); setCustomOption(false); setOptionQuery('') }}><Plus size={14} /> Add options like size or color</button>
            )}
          </section>

          <section className="detail-card">
            <div className="card-title">
              <h2>Product metafields</h2>
              <button type="button" className="ghost" onClick={() => setDefining(true)}>Add definition</button>
            </div>
            {fields.length === 0 && <p className="muted">No metafields pinned</p>}
            {fields.map(name => (
              <p key={name} className="pinned-field">{name}
                <button type="button" className="icon-btn" aria-label={`Remove ${name}`} onClick={() => setFields(current => current.filter(item => item !== name))}><X size={12} /></button>
              </p>
            ))}
            {!fields.includes('Disclosures') && <button type="button" className="meta-add-one" onClick={() => setFields(current => [...current, 'Disclosures'])}><Plus size={12} /> Disclosures</button>}
            {defining && (
              <div className="tag-form">
                <input value={definition} autoFocus placeholder="Metafield name" onChange={e => setDefinition(e.target.value)} />
                <button type="button" className="solid" onClick={() => { if (!definition.trim()) return; setFields(current => [...current, definition.trim()]); setDefinition(''); setDefining(false) }}>Add</button>
              </div>
            )}
          </section>

          <section className="detail-card seo-card">
            <div className="card-title"><h2>Search engine listing</h2></div>
            {listing ? (
              <>
                <p>Maison</p>
                <p className="muted">https://maison.co.ke/products/{title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product'}</p>
                <p className="seo-title">{title.trim() || 'Untitled'}</p>
                <p>{description.trim() || priceLabel}</p>
              </>
            ) : <p className="muted">Add a title and description to see how this product might appear in a search engine listing</p>}
          </section>
        </div>

        <aside className="order-side">
          <section className="detail-card">
            <h2>Status</h2>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </section>
          <section className="detail-card">
            <h2>Publishing</h2>
            <label className="check-line"><input type="checkbox" checked={channels} onChange={e => setChannels(e.target.checked)} /> All channels</label>
          </section>
          <section className="detail-card">
            <h2>Product organization</h2>
            <label className="field">Type
              <select value={productType} onChange={e => setProductType(e.target.value)}>
                <option value="">None</option>
                {TYPES.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">Vendor
              <select value={vendor} onChange={e => setVendor(e.target.value)}>
                <option value="">None</option>
                <option>Maison</option>
              </select>
            </label>
            <div className="field">
              <span>Collections</span>
              {chosen.map(id => {
                const row = (collections || []).find(item => item.id === id)
                return <button type="button" key={id} className="chip" onClick={() => setChosen(current => current.filter(item => item !== id))}>{row?.title || id} <X size={12} /></button>
              })}
              <button type="button" className="text-link" onClick={() => setPicking(o => !o)}>Add collections</button>
              {picking && (collections || []).filter(row => !chosen.includes(row.id)).map(row => (
                <button type="button" key={row.id} className="text-link" onClick={() => setChosen(current => [...current, row.id])}>{row.title}</button>
              ))}
            </div>
            <div className="field">
              <span>Tags</span>
              <div className="tag-list">
                {tags.map(item => (
                  <button type="button" key={item} className="chip" onClick={() => setTags(current => current.filter(tagName => tagName !== item))}>{item} <X size={12} /></button>
                ))}
              </div>
              {tagging ? (
                <div className="tag-form">
                  <input value={tag} autoFocus placeholder="Add a tag" onChange={e => setTag(e.target.value)} onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    if (!tag.trim()) return
                    setTags(current => current.includes(tag.trim()) ? current : [...current, tag.trim()])
                    setTag('')
                    setTagging(false)
                  }} />
                </div>
              ) : <button type="button" className="text-link" onClick={() => setTagging(true)}>Add tags</button>}
            </div>
            <label className="field">Theme template
              <select value={theme} onChange={e => setTheme(e.target.value)}>
                <option>Default product</option>
              </select>
            </label>
          </section>
        </aside>
      </div>
    </form>
  )
}
