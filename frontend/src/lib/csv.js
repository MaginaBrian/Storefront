export function csv(rows, name) {
  const body = rows.map(r => r.map(c => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
