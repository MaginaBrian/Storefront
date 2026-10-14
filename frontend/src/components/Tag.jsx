export function Tag({ kind, children }) {
  return <span className={`tag ${kind}`}><i />{children}</span>
}
