// Recent searches live on this device only (localStorage); nothing is sent to the server.
const KEY = 'bidigo:recent-searches:v1'
const EVENT = 'bidigo:recent-searches'
const MAX = 8

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
    // storage full / blocked: history just isn't kept
  }
  window.dispatchEvent(new Event(EVENT))
}

export function getRecentSearches(): string[] {
  return read()
}

export function addRecentSearch(term: string) {
  const t = term.trim().replace(/\s+/g, ' ')
  if (t.length < 2) return
  const rest = read().filter((x) => x.toLowerCase() !== t.toLowerCase())
  write([t, ...rest].slice(0, MAX))
}

export function removeRecentSearch(term: string) {
  write(read().filter((x) => x !== term))
}

export function clearRecentSearches() {
  write([])
}

export function subscribeRecentSearches(fn: () => void) {
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}
