import { useEffect, useState } from 'react'
import { request } from '../api/client.js'

export function useJson(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const load = () => request(path).then(d => { setData(d); setError(null) }).catch(() => setError('Could not load this list.'))
  useEffect(() => { load() }, [path])
  return [data, load, error]
}

export function useApi(path) {
  const [data, setData] = useState(null)
  const load = () => request(path).then(setData).catch(() => {})
  useEffect(() => { load() }, [path])
  return [data, load]
}
