import type { Auction, Category } from './database.types'
import { composeForYou, FOR_YOU_SIZE } from './forYou'
import { AUCTION_CARD_COLUMNS, supabase } from './supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Lista „Dla Ciebie”. Normalnie jedno RPC (bidigo-backend V140); gdy RPC jest niedostępne (np. migracja jeszcze nie
 * poszła), ta sama lista składana lokalnie z puli aktywnych aukcji. Rzuca tylko wtedy, gdy zawiodły oba sposoby.
 */
async function loadOnce(viewedIds: string[], userId: string | null, categories: Category[]): Promise<Auction[]> {
  const ids = viewedIds.filter((id) => UUID.test(id)).slice(0, 24)
  const rpc = await supabase.rpc('for_you_auctions', { p_viewed: ids, p_limit: FOR_YOU_SIZE }).select(AUCTION_CARD_COLUMNS)
  if (!rpc.error) return (rpc.data as unknown as Auction[]) ?? []

  const pool = await supabase
    .from('auctions')
    .select(`${AUCTION_CARD_COLUMNS}, created_at, watch_count`)
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .gt('ends_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(80)
  if (pool.error) throw pool.error
  const parentOf: Record<string, string | null> = {}
  for (const c of categories) parentOf[c.id] = c.parent_id ?? null
  const list = (pool.data as unknown as Auction[]) ?? []
  // oglądane, które nie weszły do puli, nie są potrzebne: composeForYou i tak zaczyna od świeżych aukcji
  return composeForYou(list, { viewedIds, userId, parentOf }).items
}

/** Pojedyncze oczekiwanie nie może trwać w nieskończoność: po limicie sekcja pokazuje błąd z „Spróbuj ponownie”. */
export function loadForYou(viewedIds: string[], userId: string | null, categories: Category[], timeoutMs = 15_000): Promise<Auction[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    loadOnce(viewedIds, userId, categories).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}
