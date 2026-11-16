import { ApiError } from './bidigoApi'
import { supabase } from './supabase'

// Import of the seller's own offers from Allegro: bidigo-api /api/v1/allegro (OAuth and Allegro's API live on the server).

export type AllegroStatus = { configured: boolean; connected: boolean; login?: string }
export type AllegroOffer = {
  id: string
  title: string
  price?: number
  currency?: string
  imageUrl?: string
  status?: string
  stock?: number
}
export type AllegroOfferPage = { offers: AllegroOffer[]; total: number }
export type AllegroOfferDetail = {
  id: string
  title: string
  description: string
  price?: number
  currency?: string
  imageUrls: string[]
  categoryId?: string
  stock?: number
  url: string
}

async function call(method: string, path: string): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`/api/v1/allegro${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return res
}

export const allegroStatus = async () => (await call('GET', '/status')).json() as Promise<AllegroStatus>
export const allegroConnectUrl = async () => ((await (await call('POST', '/connect')).json()) as { url: string }).url
export const allegroDisconnect = async () => void (await call('DELETE', '/connection'))
export const allegroOffers = async (offset = 0, limit = 50) =>
  (await call('GET', `/offers?offset=${offset}&limit=${limit}`)).json() as Promise<AllegroOfferPage>
export const allegroOffer = async (id: string) =>
  (await call('GET', `/offers/${encodeURIComponent(id)}`)).json() as Promise<AllegroOfferDetail>

/** A photo of an offer, downloaded through the server (Allegro's CDN sends no CORS headers) as a File. */
export async function allegroPhoto(url: string, name: string): Promise<File> {
  const blob = await (await call('GET', `/image?url=${encodeURIComponent(url)}`)).blob()
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
  return new File([blob], `${name}.${ext}`, { type: blob.type || 'image/jpeg' })
}
