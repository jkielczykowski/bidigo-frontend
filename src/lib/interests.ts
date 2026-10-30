// Interest profile: which categories this device keeps looking at (searches, viewed auctions).
// Scores decay with a 7-day half-life, so the profile follows what you care about right now.
// Stored on this device only (localStorage).
const KEY = 'bidigo:interests:v1'
const EVENT = 'bidigo:interests'
const HALF_LIFE_MS = 7 * 24 * 3600_000
const MAX_ENTRIES = 12
const MIN_SCORE = 0.3

type Stored = Record<string, { name: string; score: number; at: number }>

export type Interest = { id: string; name: string; score: number }

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : {}
    return v && typeof v === 'object' ? (v as Stored) : {}
  } catch {
    return {}
  }
}

function write(v: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // storage full / blocked: the profile just isn't kept
  }
  window.dispatchEvent(new Event(EVENT))
}

function effective(e: { score: number; at: number }, now: number) {
  return e.score * Math.pow(0.5, (now - e.at) / HALF_LIFE_MS)
}

export function recordInterest(categoryId: string, name: string, weight: number) {
  if (!categoryId) return
  const now = Date.now()
  const all = read()
  const prev = all[categoryId]
  all[categoryId] = { name: name || prev?.name || '', score: (prev ? effective(prev, now) : 0) + weight, at: now }
  const kept = Object.entries(all)
    .map(([id, e]) => [id, e, effective(e, now)] as const)
    .filter(([, , s]) => s >= MIN_SCORE)
    .sort((a, b) => b[2] - a[2])
    .slice(0, MAX_ENTRIES)
  write(Object.fromEntries(kept.map(([id, e]) => [id, e])))
}

export function getInterests(): Interest[] {
  const now = Date.now()
  return Object.entries(read())
    .map(([id, e]) => ({ id, name: e.name, score: effective(e, now) }))
    .filter((i) => i.score >= MIN_SCORE && i.name)
    .sort((a, b) => b.score - a.score)
}

export function removeInterest(id: string) {
  const all = read()
  delete all[id]
  write(all)
}

export function clearInterests() {
  write({})
}

export function subscribeInterests(fn: () => void) {
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}
