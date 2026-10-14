import { useState } from 'react'
import { useJson } from '../lib/api.js'
import { EmptyPane } from './ui.jsx'

function BlogMark() {
  return (
    <svg className="empty-mark" viewBox="0 0 120 100" aria-hidden="true">
      <circle cx="60" cy="50" r="34" fill="#f4f1ea" />
      <rect x="40" y="24" width="40" height="52" rx="4" fill="#fff" stroke="#e4e0d6" />
      <rect x="48" y="34" width="18" height="6" rx="2" fill="#d9d3c7" />
      <rect x="48" y="44" width="24" height="4" rx="2" fill="#ece8df" />
      <rect x="48" y="52" width="20" height="4" rx="2" fill="#ece8df" />
    </svg>
  )
}

export function BlogPosts({ focus = {}, onOpen }) {
  const [rows, reload] = useJson('/api/blog-posts')
  const [manage, setManage] = useState(false)
  if (focus.create === '1') return <NewPost onOpen={onOpen} onSaved={reload} />
  const actions = <button type="button" className="ghost" onClick={() => setManage(value => !value)}>Manage blogs</button>
  if (!rows) return <p className="muted">Loading blog posts…</p>
  return (
    <>
      {rows.length === 0 ? (
        <EmptyPane
          title="Blog posts"
          actions={actions}
          heading="Write a blog post"
          text="Blog posts are a great way to build a community around your products and your brand."
          extra={<button type="button" className="ghost" onClick={() => window.open('https://help.shopify.com/en/manual/online-store/blogs', '_blank', 'noreferrer')}>Learn more</button>}
          action="Create blog post"
          onAction={() => onOpen('blog-posts', { create: '1' })}
          mark={<BlogMark />}
        />
      ) : (
        <>
          <div className="orders-top"><h1>Blog posts</h1><div className="orders-actions">{actions}<button type="button" className="solid" onClick={() => onOpen('blog-posts', { create: '1' })}>Create blog post</button></div></div>
          <div className="sheet">
            <table>
              <thead><tr><th>Title</th><th>Blog</th><th>Date</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.id}><td>{row.title}</td><td>{row.blog}</td><td>{row.created_at}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      {manage && (
        <section className="panel">
          <h2>News</h2>
          <p>Posts you create are published on the News blog.</p>
        </section>
      )}
    </>
  )
}

function NewPost({ onOpen, onSaved }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = () => {
    if (!title.trim()) { setError('Enter a title.'); return }
    setBusy(true)
    fetch('/api/blog-posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    }).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save')
      onSaved()
      onOpen('blog-posts')
    }).catch(err => { setError(err.message); setBusy(false) })
  }
  return (
    <div className="order-page company-page">
      <div className="crumb">
        <button type="button" className="text-link" onClick={() => onOpen('blog-posts')}>Blog posts</button>
        <span>/</span> Create blog post
      </div>
      <h1>Create blog post</h1>
      {error && <p className="form-error">{error}</p>}
      <section className="detail-card">
        <label className="field">Title<input value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="field">Body<textarea rows={6} value={body} onChange={e => setBody(e.target.value)} /></label>
        <div className="orders-actions">
          <button type="button" className="ghost" onClick={() => onOpen('blog-posts')}>Discard</button>
          <button type="button" className="solid" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </section>
    </div>
  )
}
