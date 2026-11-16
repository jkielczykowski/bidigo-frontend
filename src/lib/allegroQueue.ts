// Pure helpers of the Allegro import (no network, testable with node --test)

// The queue of offers picked for import: survives the page reloads between the listings, not the browser session.
const QUEUE_KEY = 'bidigo.allegroImport'
export type ImportQueue = { ids: string[]; pos: number }

export function readImportQueue(): ImportQueue | null {
  try {
    const q = JSON.parse(sessionStorage.getItem(QUEUE_KEY) ?? 'null') as ImportQueue | null
    return q && Array.isArray(q.ids) && q.pos < q.ids.length ? q : null
  } catch {
    return null
  }
}

export function writeImportQueue(q: ImportQueue | null) {
  try {
    if (q && q.pos < q.ids.length) sessionStorage.setItem(QUEUE_KEY, JSON.stringify(q))
    else sessionStorage.removeItem(QUEUE_KEY)
  } catch {
    /* private mode: the import then handles one offer at a time */
  }
}

/** Allegro's fixed price → an auction: the start at half of it, "Kup teraz" at the Allegro price. */
export function suggestPrices(price?: number): { start: number; buyNow: number | null } {
  if (!price || price < 2) return { start: Math.max(1, Math.round(price ?? 1)), buyNow: null }
  const start = Math.max(1, Math.floor(price / 2))
  return { start, buyNow: Math.round(price) > start ? Math.round(price) : null }
}
