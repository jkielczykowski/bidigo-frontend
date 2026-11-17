// Bulk import from Allegro (one table instead of a form per offer): rows, shared defaults, validation, the insert payload.
// Pure functions, no network: the page and allegroBulkApi.ts do the calls.

import { suggestCategory, type CatLite } from './allegroCategory.ts'
import { importedTexts } from './allegroSync.ts'

export const MAX_PHOTOS = 5

/** Settings applied to every imported listing */
export type BulkDefaults = {
  city: string
  lat: number | null
  lng: number | null
  shipping: string[]
  durationDays: 7 | 14
  autoRenew: boolean
  /** Starting price as a share of the Allegro price, in percent */
  startPercent: number
  /** "Kup teraz" = the Allegro price */
  withBuyNow: boolean
}

export const DEFAULT_BULK: BulkDefaults = {
  city: '',
  lat: null,
  lng: null,
  shipping: ['odbior'],
  durationDays: 7,
  autoRenew: false,
  startPercent: 50,
  withBuyNow: true,
}

export type BulkRow = {
  offerId: string
  include: boolean
  title: string
  description: string
  categoryId: string
  /** The category was picked by the matcher, not by the seller */
  guessed: boolean
  allegroPath: string[]
  allegroPrice?: number
  start: string
  buyNow: string
  imageUrls: string[]
}

export type OfferInput = {
  id: string
  title: string
  description?: string
  price?: number
  imageUrls: string[]
  categoryPath?: string[]
}

export function pricesFor(price: number | undefined, startPercent: number, withBuyNow: boolean): { start: number; buyNow: number | null } {
  if (!price || price < 2) return { start: Math.max(1, Math.round(price ?? 1)), buyNow: null }
  const pct = Math.min(100, Math.max(1, startPercent))
  const start = Math.max(1, Math.floor((price * pct) / 100))
  const buy = Math.round(price)
  return { start, buyNow: withBuyNow && buy > start ? buy : null }
}

/** Bid step that fits the price: 1 zł on a 10 zł item, 25 zł on a 1000 zł one. */
export function suggestIncrement(start: number): number {
  if (start < 20) return 1
  if (start < 100) return 5
  if (start < 500) return 10
  if (start < 2000) return 25
  return 50
}

export function makeRow(offer: OfferInput, categories: CatLite[], d: BulkDefaults): BulkRow {
  const texts = importedTexts({ title: offer.title, description: offer.description })
  const { start, buyNow } = pricesFor(offer.price, d.startPercent, d.withBuyNow)
  const guess = suggestCategory(offer.categoryPath ?? [], offer.title, categories)
  return {
    offerId: offer.id,
    include: true,
    title: texts.title,
    description: texts.description,
    categoryId: guess ?? '',
    guessed: !!guess,
    allegroPath: offer.categoryPath ?? [],
    allegroPrice: offer.price,
    start: String(start),
    buyNow: buyNow ? String(buyNow) : '',
    imageUrls: offer.imageUrls.slice(0, MAX_PHOTOS),
  }
}

/** Recalculates the prices of a row from the Allegro price (used after the shared price setting changes). */
export function repriced(row: BulkRow, d: BulkDefaults): BulkRow {
  const { start, buyNow } = pricesFor(row.allegroPrice, d.startPercent, d.withBuyNow)
  return { ...row, start: String(start), buyNow: buyNow ? String(buyNow) : '' }
}

export function leafOptions(categories: CatLite[]): { id: string; label: string }[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const parents = new Set(categories.map((c) => c.parent_id).filter(Boolean) as string[])
  const label = (id: string): string => {
    const parts: string[] = []
    for (let cur = byId.get(id); cur; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) parts.unshift(cur.name)
    return parts.join(' › ')
  }
  return categories
    .filter((c) => !parents.has(c.id))
    .map((c) => ({ id: c.id, label: label(c.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))
}

/** What stops a row from being listed (empty = ready) */
export function rowProblems(row: BulkRow, leafIds: ReadonlySet<string>): string[] {
  const p: string[] = []
  if (row.title.trim().length < 5) p.push('tytuł (min. 5 znaków)')
  if (row.description.trim().length < 5) p.push('opis (min. 5 znaków)')
  if (!leafIds.has(row.categoryId)) p.push('kategoria')
  const start = Number(row.start)
  if (!row.start || Number.isNaN(start) || start < 1) p.push('cena startowa (min. 1 zł)')
  if (row.buyNow) {
    const b = Number(row.buyNow)
    if (Number.isNaN(b) || b <= start) p.push('„Kup teraz” musi być wyższe od ceny startowej')
  }
  if (row.imageUrls.length < 1) p.push('zdjęcie (oferta nie ma zdjęć)')
  return p
}

export function defaultsProblems(d: BulkDefaults): string[] {
  const p: string[] = []
  if (d.city.trim().length < 2) p.push('miasto')
  else if (d.lat == null || d.lng == null) p.push('lokalizacja miasta (wybierz miasto z listy)')
  if (d.shipping.length < 1) p.push('dostawa')
  return p
}

/** The `auctions` row of one imported listing (photoUrls already uploaded) */
export function insertPayload(
  sellerId: string,
  row: BulkRow,
  d: BulkDefaults,
  photoUrls: string[],
  now: Date = new Date(),
): Record<string, unknown> {
  const start = Number(row.start)
  const ends = new Date(now)
  ends.setDate(ends.getDate() + d.durationDays)
  const y = ends.getFullYear()
  const m = String(ends.getMonth() + 1).padStart(2, '0')
  const day = String(ends.getDate()).padStart(2, '0')
  return {
    seller_id: sellerId,
    category_id: row.categoryId,
    title: row.title.trim(),
    description: row.description.trim(),
    image_urls: photoUrls,
    starting_price: start,
    current_price: start,
    reserve_price: null,
    bid_increment: suggestIncrement(start),
    buy_now_price: row.buyNow ? Number(row.buyNow) : null,
    status: 'active',
    starts_at: now.toISOString(),
    ends_at: new Date(`${y}-${m}-${day}T23:59:00`).toISOString(),
    city: d.city.trim(),
    lat: d.lat,
    lng: d.lng,
    shipping_options: d.shipping,
    duration_days: d.durationDays,
    auto_renew: d.autoRenew,
  }
}
