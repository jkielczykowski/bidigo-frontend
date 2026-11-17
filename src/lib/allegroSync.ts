// Which imported listings follow their Allegro offer: pure planning, no network (the page does the calls).

export type LinkedListing = {
  auctionId: string
  offerId: string
  title: string
  description: string
  status: string
  bidCount: number
  // shown in the table of imported listings
  currentPrice?: number
  endsAt?: string | null
  imageUrl?: string | null
  importedAt?: string
  /** The Allegro offer was ended because the auction sold on Bidigo */
  endedOnAllegro?: boolean
}

export type OfferTexts = { title: string; description: string }

export type SyncPlan = {
  /** Offer text changed on Allegro: title and description of the Bidigo listing follow */
  update: { auctionId: string; title: string; oldTitle: string; description: string }[]
  /** Offer gone from Allegro: the listing is cancelled */
  cancel: { auctionId: string; title: string }[]
  /** Listings with bids: left alone */
  locked: { auctionId: string; title: string; gone: boolean }[]
}

const TITLE_MAX = 120
const DESCRIPTION_MAX = 4000

/** The title and description a listing gets from an offer (the create form uses the same rule). */
export function importedTexts(offer: { title: string; description?: string }): OfferTexts {
  const title = offer.title.slice(0, TITLE_MAX).trim()
  const description = (offer.description?.trim() ? offer.description : offer.title).slice(0, DESCRIPTION_MAX).trim()
  return { title, description }
}

function same(a: string, b: string): boolean {
  return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()
}

/**
 * @param presentOfferIds ids of ALL active Allegro offers
 * @param complete        the whole offer list was fetched without an error: only then may a missing offer cancel anything
 * @param texts           current text of the offers still on Allegro (listings with bids are not fetched)
 */
export function planSync(
  linked: LinkedListing[],
  presentOfferIds: ReadonlySet<string>,
  complete: boolean,
  texts: ReadonlyMap<string, OfferTexts>,
): SyncPlan {
  const plan: SyncPlan = { update: [], cancel: [], locked: [] }
  for (const l of linked) {
    if (l.status !== 'active') continue
    const present = presentOfferIds.has(l.offerId)
    if (!present && !complete) continue
    if (l.bidCount > 0) {
      plan.locked.push({ auctionId: l.auctionId, title: l.title, gone: !present })
      continue
    }
    if (!present) {
      plan.cancel.push({ auctionId: l.auctionId, title: l.title })
      continue
    }
    const t = texts.get(l.offerId)
    if (t && t.title && (!same(t.title, l.title) || !same(t.description, l.description))) {
      plan.update.push({ auctionId: l.auctionId, title: t.title, oldTitle: l.title, description: t.description })
    }
  }
  return plan
}
