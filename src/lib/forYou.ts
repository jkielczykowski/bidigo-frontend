// „Dla Ciebie” na stronie głównej: czysta logika wyboru aukcji i stanów sekcji. Te same reguły (w tej samej kolejności)
// ma RPC for_you_auctions (bidigo-backend V140) i aplikacja (bidigo-app lib/for_you.dart). To jest też zapas, gdy RPC
// jest niedostępne: z puli aktywnych aukcji budujemy listę lokalnie.

/** Ile kart ma mieć sekcja (tyle, ile najdłuższy rząd „Ostatnio oglądane”). */
export const FOR_YOU_SIZE = 12

export type FyAuction = {
  id: string
  seller_id?: string | null
  category_id?: string | null
  bid_count?: number | null
  watch_count?: number | null
  ends_at: string
  created_at?: string | null
}

export type FyContext = {
  /** ids ostatnio oglądanych aukcji, najnowsza pierwsza */
  viewedIds: string[]
  /** id zalogowanego użytkownika (null = gość) */
  userId: string | null
  /** kategorie obserwowanych / licytowanych aukcji (ważniejsze pierwsze) */
  favoriteCategoryIds?: string[]
  /** kategoria -> rodzic, żeby „podobne” obejmowały też rodzeństwo z jednej kategorii nadrzędnej */
  parentOf?: Record<string, string | null | undefined>
  limit?: number
}

export type FyTier = 'similar' | 'favorite' | 'popular' | 'ending' | 'newest' | 'viewed' | 'own'

const num = (n: number | null | undefined) => n ?? 0
const time = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/** Dodaje do listy elementy z kolejnych źródeł: bez duplikatów, do limitu. */
export function mergeUnique<T extends { id: string }>(lists: T[][], limit: number): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const list of lists) {
    for (const a of list) {
      if (out.length >= limit) return out
      if (seen.has(a.id)) continue
      seen.add(a.id)
      out.push(a)
    }
  }
  return out
}

function related(a: FyAuction, cats: string[], parentOf: FyContext['parentOf']): boolean {
  const c = a.category_id
  if (!c) return false
  const parent = parentOf?.[c]
  return cats.some((x) => x === c || (parent != null && parentOf?.[x] === parent) || parentOf?.[x] === c || x === parent)
}

/**
 * Łańcuch: podobne do oglądanych -> ulubione kategorie -> popularne -> kończące się -> najnowsze, a gdy to za mało
 * (np. w serwisie są tylko aukcje oglądane lub własne) -> oglądane -> własne. `pool` to aktywne, zatwierdzone,
 * trwające aukcje. Zwraca listę bez duplikatów, do `limit`.
 */
export function composeForYou<T extends FyAuction>(pool: T[], ctx: FyContext): { items: T[]; tiers: Record<string, FyTier> } {
  const limit = ctx.limit ?? FOR_YOU_SIZE
  const viewed = new Set(ctx.viewedIds)
  const fresh = pool.filter((a) => a.seller_id !== ctx.userId && !viewed.has(a.id))
  const viewedCats: string[] = []
  const byId = new Map(pool.map((a) => [a.id, a]))
  for (const id of ctx.viewedIds) {
    const c = byId.get(id)?.category_id
    if (c && !viewedCats.includes(c)) viewedCats.push(c)
  }
  const catRank = (a: FyAuction, cats: string[]) => {
    const i = cats.indexOf(a.category_id ?? '')
    return i < 0 ? cats.length : i
  }

  const similar = fresh
    .filter((a) => related(a, viewedCats, ctx.parentOf))
    .sort((a, b) => catRank(a, viewedCats) - catRank(b, viewedCats) || time(a.ends_at) - time(b.ends_at))
  const fav = ctx.favoriteCategoryIds ?? []
  const favorite = fresh
    .filter((a) => related(a, fav, ctx.parentOf))
    .sort((a, b) => catRank(a, fav) - catRank(b, fav) || time(a.ends_at) - time(b.ends_at))
  const popular = fresh
    .filter((a) => num(a.bid_count) + num(a.watch_count) > 0)
    .sort((a, b) => num(b.bid_count) + num(b.watch_count) - (num(a.bid_count) + num(a.watch_count)) || time(a.ends_at) - time(b.ends_at))
  const ending = [...fresh].sort((a, b) => time(a.ends_at) - time(b.ends_at))
  const newest = [...fresh].sort((a, b) => time(b.created_at) - time(a.created_at))
  const viewedLeft = ctx.viewedIds.map((id) => byId.get(id)).filter((a): a is T => !!a && a.seller_id !== ctx.userId)
  const own = pool.filter((a) => ctx.userId != null && a.seller_id === ctx.userId)

  const sources: [FyTier, T[]][] = [
    ['similar', similar],
    ['favorite', favorite],
    ['popular', popular],
    ['ending', ending],
    ['newest', newest],
    ['viewed', viewedLeft],
    ['own', own],
  ]
  const tiers: Record<string, FyTier> = {}
  for (const [tier, list] of sources) for (const a of list) if (!(a.id in tiers)) tiers[a.id] = tier
  return { items: mergeUnique(sources.map(([, l]) => l), limit), tiers }
}

export type ForYouView = 'loading' | 'error' | 'items' | 'empty'

/** Co pokazuje sekcja: nagłówek bez treści nie istnieje — zawsze karty, szkielety, błąd albo zachęta. */
export function forYouView(s: { loading: boolean; error: boolean; count: number }): ForYouView {
  if (s.count > 0) return 'items'
  if (s.loading) return 'loading'
  if (s.error) return 'error'
  return 'empty'
}

/** Tytuł rzędu z poleceniami zależnie od tego, na czym stoi lista. */
export function forYouTitle(hasViewed: boolean, signedIn: boolean): string {
  if (hasViewed) return 'Polecane na podstawie oglądanych'
  return signedIn ? 'Polecane dla Ciebie' : 'Popularne i kończące się'
}
