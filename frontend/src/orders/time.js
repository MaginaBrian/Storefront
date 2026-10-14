export function formatWhen(iso) {
  const d = new Date(iso)
  const month = d.toLocaleString('en-US', { month: 'short' })
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${month} ${d.getDate()} at ${h}:${m} ${ap}`
}
export function longWhen(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${date} at ${h}:${m} ${ap}`
}
export function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
export function dayLabel(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
export function updatedWhen(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `Updated by Maison Admin ${date}, ${h}:${m} ${ap}`
}
export function bannerWhen(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}
