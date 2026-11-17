import { allegroPhoto } from './allegroApi'
import { insertPayload, type BulkDefaults, type BulkRow } from './allegroBulk'
import { linkListing } from './allegroSyncApi'
import { newId } from './id'
import { supabase } from './supabase'

/** Photos → storage, the auctions row, the Allegro link. Returns the new auction id; throws the database error as is. */
export async function createListing(userId: string, row: BulkRow, d: BulkDefaults): Promise<string> {
  const urls: string[] = []
  for (const [i, url] of row.imageUrls.entries()) {
    try {
      const file = await allegroPhoto(url, `allegro-${row.offerId}-${i + 1}`)
      const ext = file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${userId}/${newId()}.${ext}`
      const { error } = await supabase.storage.from('auction-images').upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type,
      })
      if (error) continue
      urls.push(supabase.storage.from('auction-images').getPublicUrl(path).data.publicUrl)
    } catch {
      // one photo failing must not stop the listing
    }
  }
  if (urls.length < 1) throw new Error('Nie udało się pobrać zdjęć tej oferty.')

  const payload = insertPayload(userId, row, d, urls)
  let { data, error } = await supabase.from('auctions').insert(payload).select('id').single()
  // An older database without these columns: try without the optional ones (as the single form does)
  if (error && /lat|lng|auto_renew|duration_days|column/i.test(error.message)) {
    const { duration_days: _d, auto_renew: _a, lat: _la, lng: _ln, ...legacy } = payload
    ;({ data, error } = await supabase.from('auctions').insert(legacy).select('id').single())
  }
  if (error) throw error
  const id = (data as { id: string }).id
  await linkListing(id, row.offerId)
  return id
}
