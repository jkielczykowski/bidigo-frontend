// Auctions this visitor opened lately (ids only, this device only, newest first).
const KEY = 'bidigo:recent-views:v1'
const EVENT = 'bidigo:recent-views'
const MAX = 12

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage full / blocked: the list just isn't kept
  }
  window.dispatchEvent(new Event(EVENT))
}

export function getRecentViews(): string[] {
  return read()
}

export function addRecentView(id: string) {
  if (!id) return
  const list = read()
  if (list[0] === id) return
  write([id, ...list.filter((x) => x !== id)].slice(0, MAX))
}

export function clearRecentViews() {
  write([])
}

export function subscribeRecentViews(fn: () => void) {
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}
