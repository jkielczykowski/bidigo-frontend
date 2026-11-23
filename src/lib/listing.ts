import type { Category } from './database.types'

export type ItemCondition = 'new' | 'like_new' | 'used' | 'for_parts'

export const CONDITIONS: { id: ItemCondition; label: string }[] = [
  { id: 'new', label: 'Nowy' },
  { id: 'like_new', label: 'Jak nowy' },
  { id: 'used', label: 'Używany' },
  { id: 'for_parts', label: 'Na części lub uszkodzony' },
]

/** Polish label of a stored condition; null for old auctions (no value) and unknown values. */
export function conditionLabel(value: string | null | undefined): string | null {
  return CONDITIONS.find((c) => c.id === value)?.label ?? null
}

export const PICKUP_EXCLUDED_TEXT = 'Przedmioty z tej kategorii nie mogą być odbierane osobiście, tylko wysyłane.'

type CatPickup = Pick<Category, 'id'> & { parent_id?: string | null; pickup_allowed?: boolean | null }

/**
 * Does the category (after inheriting from its parents) allow personal pickup?
 * null/undefined flag = inherit; nothing set up the tree = allowed (the current behaviour).
 */
export function pickupAllowedFor(categories: CatPickup[], categoryId: string | null | undefined): boolean {
  if (!categoryId) return true
  const byId = new Map(categories.map((c) => [c.id, c]))
  const seen = new Set<string>()
  let cur = byId.get(categoryId)
  while (cur && !seen.has(cur.id)) {
    if (cur.pickup_allowed != null) return cur.pickup_allowed
    seen.add(cur.id)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return true
}

/** The location (city + map) is needed only when personal pickup is among the delivery options. */
export function needsLocation(shipping: string[]): boolean {
  return shipping.includes('odbior')
}

export type CategorySuggestion = { id: string; name: string; path: string; score: number }

/** Normalises the rows of `suggest_categories` (drops malformed ones, best first, at most `limit`). */
export function parseSuggestions(data: unknown, limit = 3): CategorySuggestion[] {
  if (!Array.isArray(data)) return []
  const out: CategorySuggestion[] = []
  for (const r of data as Record<string, unknown>[]) {
    if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') continue
    out.push({
      id: r.id,
      name: r.name,
      path: typeof r.path === 'string' ? r.path : r.name,
      score: Number(r.score) || 0,
    })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Local mirror of `suggest_bid_increment` (about 1% of the price, rounded to 1/2/5/10 zł, 1–50 zł); used until the server answers. */
export function localBidIncrement(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 1
  const raw = Math.min(50, Math.max(1, price / 100))
  if (raw >= 50) return 50
  const steps = [1, 2, 5, 10, 20, 50]
  return steps.reduce((best, s) => (Math.abs(s - raw) < Math.abs(best - raw) ? s : best), 1)
}

/** Buyer-facing text for the share button: false when the clipboard is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
