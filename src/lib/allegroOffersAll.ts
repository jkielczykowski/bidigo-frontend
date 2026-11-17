import { allegroOffers, type AllegroOffer } from './allegroApi'

/** Offers fetched per request (the API allows 100) */
export const OFFERS_PAGE = 50
/** Safety cap on one load-everything run */
export const MAX_OFFERS = 2000

export type AllOffers = { offers: AllegroOffer[]; total: number; complete: boolean }

/**
 * Fetches every page of the seller's active Allegro offers one after another.
 * `onPage` gets everything fetched so far (for a progress bar); `stopped()` aborts quietly (returns null).
 * `complete` means the whole list arrived: only then may a missing offer be read as "gone from Allegro".
 */
export async function fetchAllOffers(
  onPage: (offers: AllegroOffer[], total: number) => void,
  stopped: () => boolean,
): Promise<AllOffers | null> {
  const all: AllegroOffer[] = []
  let total = 0
  for (;;) {
    const page = await allegroOffers(all.length, OFFERS_PAGE)
    if (stopped()) return null
    all.push(...page.offers)
    total = page.total
    onPage([...all], total)
    if (page.offers.length === 0 || all.length >= total || all.length >= MAX_OFFERS) break
  }
  return { offers: all, total, complete: total > 0 && all.length === total }
}
