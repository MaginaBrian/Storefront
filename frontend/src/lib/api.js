import { useEffect, useState } from 'react'

export function useJson(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const load = () => fetch(path).then(r => {
    if (!r.ok) throw new Error()
    return r.json()
  }).then(d => { setData(d); setError(null) }).catch(() => setError('Could not load this list.'))
  useEffect(() => { load() }, [path])
  return [data, load, error]
}

export function useApi(path) {
  const [data, setData] = useState(null)
  const load = () => fetch(path).then(r => r.json()).then(setData)
  useEffect(() => { load() }, [path])
  return [data, load]
}
