import { supabase } from './supabase'
import type { LinkedListing } from './allegroSync'

// Remembering and syncing which Bidigo listing came from which Allegro offer (tables/functions: V60).

/** Called right after an imported listing was created; a failure only means the listing is not tracked. */
export async function linkListing(auctionId: string, offerId: string): Promise<void> {
  try {
    await supabase.rpc('allegro_link_auction', { p_auction_id: auctionId, p_offer_id: offerId })
  } catch {
    // the listing exists either way
  }
}

type Row = {
  auction_id: string
  offer_id: string
  auctions: { id: string; title: string; description: string | null; status: string; bid_count: number } | null
}

export async function myLinkedListings(): Promise<LinkedListing[]> {
  const { data, error } = await supabase
    .from('allegro_listings')
    .select('auction_id, offer_id, auctions!inner(id, title, description, status, bid_count)')
  if (error) throw error
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.auctions)
    .map((r) => ({
      auctionId: r.auction_id,
      offerId: r.offer_id,
      title: r.auctions!.title,
      description: r.auctions!.description ?? '',
      status: r.auctions!.status,
      bidCount: r.auctions!.bid_count,
    }))
}

export async function syncUpdate(auctionId: string, title: string, description: string): Promise<void> {
  const { error } = await supabase.rpc('allegro_sync_update', {
    p_auction_id: auctionId,
    p_title: title,
    p_description: description,
  })
  if (error) throw error
}

export async function syncCancel(auctionId: string): Promise<void> {
  const { error } = await supabase.rpc('allegro_sync_cancel', { p_auction_id: auctionId })
  if (error) throw error
}
