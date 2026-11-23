export type SuggestCategory = {
  id: string
  name: string
  path: string
  parent_id: string | null
}

export type SuggestAuction = {
  id: string
  title: string
  current_price: number
  city: string
  image_url: string | null
  category_name: string
  ends_at: string
}

export type SuggestResponse = {
  categories: SuggestCategory[]
  auctions: SuggestAuction[]
  engine?: string
}

export type SearchHit = {
  id: string
  title: string
  description?: string
  city?: string
  condition?: string | null
  category_id?: string
  category_name?: string
  current_price: number
  starting_price?: number
  bid_count?: number
  ends_at: string
  image_urls?: string[]
  seller_id?: string
  status?: string
  moderation_status?: string
  created_at?: string
}

export type SearchResponse = {
  engine: string
  total: number
  hits: SearchHit[]
  ids: string[]
}

const BASE = '/api/search'

export async function fetchSuggest(q: string, signal?: AbortSignal): Promise<SuggestResponse> {
  const url = `${BASE}/suggest?q=${encodeURIComponent(q)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Suggest failed (${res.status})`)
  return (await res.json()) as SuggestResponse
}

export async function fetchSearch(params: {
  q?: string
  category?: string
  city?: string
  lat?: string | number
  lng?: string | number
  radiusKm?: string | number
  priceFrom?: string
  priceTo?: string
  condition?: string
  sort?: string
  limit?: number
  offset?: number
  signal?: AbortSignal
}): Promise<SearchResponse> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.category && params.category !== 'all') sp.set('category', params.category)
  if (params.city) sp.set('city', params.city)
  if (params.lat != null && params.lat !== '') sp.set('lat', String(params.lat))
  if (params.lng != null && params.lng !== '') sp.set('lng', String(params.lng))
  if (params.radiusKm != null && params.radiusKm !== '') sp.set('radius_km', String(params.radiusKm))
  if (params.priceFrom) sp.set('price_from', params.priceFrom)
  if (params.priceTo) sp.set('price_to', params.priceTo)
  if (params.condition) sp.set('condition', params.condition)
  if (params.sort) sp.set('sort', params.sort)
  if (params.limit != null) sp.set('limit', String(params.limit))
  if (params.offset != null) sp.set('offset', String(params.offset))

  const res = await fetch(`${BASE}/search?${sp}`, { signal: params.signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  return (await res.json()) as SearchResponse
}
