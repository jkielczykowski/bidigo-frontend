import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/** Public profile columns — `phone` is not readable by clients (own profile: rpc('my_profile')). */
export const PUBLIC_PROFILE_COLUMNS =
  'id, username, display_name, city, avatar_url, bio, rating_avg, rating_count, is_admin, phone_verified_at, created_at, updated_at'

/** Columns an auction card (home page, search results) actually renders — not whole rows. */
export const AUCTION_CARD_COLUMNS =
  'id, title, image_urls, current_price, starting_price, buy_now_price, bid_count, ends_at, city, status, moderation_status, category_id, seller_id, promoted_until, category:categories(id, name, icon, parent_id)'
