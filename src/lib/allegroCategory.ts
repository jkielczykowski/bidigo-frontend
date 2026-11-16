// Allegro category path → a leaf category of Bidigo. Pure (no network): the server sends the path names
// (root → leaf) of the offer's category, the form matches them against the loaded Bidigo categories.

export type CatLite = { id: string; name: string; parent_id?: string | null }

/** Allegro's top-level categories → the Bidigo top-level ones they usually belong to. */
const ROOTS: Record<string, string[]> = {
  elektronika: ['elektronika', 'komputery', 'telefony', 'foto', 'gry'],
  moda: ['moda', 'zegarki'],
  'dom i ogrod': ['dom', 'ogrod'],
  dziecko: ['dziecko'],
  uroda: ['uroda'],
  zdrowie: ['uroda'],
  'kultura i rozrywka': ['ksiazki', 'muzyka', 'gry', 'bilety'],
  'sport i turystyka': ['sport'],
  motoryzacja: ['pojazdy'],
  'kolekcje i sztuka': ['kolekcje'],
  'firma i uslugi': ['biznes'],
  supermarket: ['dom'],
}

const STOP = new Set(['i', 'w', 'z', 'do', 'na', 'dla', 'oraz', 'inne', 'inna', 'pozostale'])

/** Allegro's wording → Bidigo's */
const SYNONYMS: [RegExp, string][] = [
  [/obuwie/g, 'buty'],
  [/fantastyk\w*|powiesc\w*|kryminal\w*|literatur\w*|romans\w*|thriller\w*|horror\w*/g, 'beletrystyka'],
]

export function normalize(s: string): string {
  const plain = s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return SYNONYMS.reduce((acc, [re, to]) => acc.replace(re, to), plain)
}

/** Words reduced to a 5-letter stem so that "telefony", "telefon" and "telefonów" meet */
export function stems(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => w.slice(0, 5))
}

function pathOf(id: string, byId: Map<string, CatLite>): CatLite[] {
  const out: CatLite[] = []
  let cur = byId.get(id)
  for (let i = 0; cur && i < 6; i++) {
    out.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return out
}

/**
 * The best Bidigo leaf for an Allegro offer, or null when nothing fits well enough (the seller picks then).
 * @param allegroPath category names root → leaf; may be empty (then only the title is used)
 */
export function suggestCategory(allegroPath: string[], title: string, categories: CatLite[]): string | null {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const hasChild = new Set(categories.map((c) => c.parent_id).filter(Boolean) as string[])
  const leaves = categories.filter((c) => !hasChild.has(c.id))

  // The last level is often a brand or a model ("Apple", "Dell"), so the last two levels both count as the leaf
  const leafStems = new Set(allegroPath.slice(-2).flatMap(stems))
  // the very last level is the most specific one
  const lastStems = new Set(stems(allegroPath[allegroPath.length - 1] ?? ''))
  // the root ("Dom i Ogród") is too broad to match on: it only picks the preferred Bidigo roots
  const upperStems = new Set(allegroPath.slice(1, -2).flatMap(stems))
  const titleStems = new Set(stems(title))
  const preferredRoots = new Set(ROOTS[normalize(allegroPath[0] ?? '')] ?? [])

  // A word that names few leaves ("sukienki") says more than one that names many ("damskie")
  const df = new Map<string, number>()
  for (const leaf of leaves) for (const w of new Set(stems(leaf.name))) df.set(w, (df.get(w) ?? 0) + 1)
  const idf = (w: string) => Math.log(1 + leaves.length / (df.get(w) ?? 1)) / Math.log(1 + leaves.length)

  // Without a path the title is all we have, so it counts as much as the path's leaf would
  const titleWeight = allegroPath.length ? 1 : 3
  let best: { id: string; score: number } | null = null
  for (const leaf of leaves) {
    const chain = pathOf(leaf.id, byId)
    const own = stems(leaf.name)
    if (own.length === 0) continue
    const above = new Set(chain.slice(0, -1).flatMap((c) => stems(c.name)))

    let hit = 0
    let score = 0
    for (const w of own) {
      if (lastStems.has(w)) (score += 4.5 * idf(w)), hit++
      else if (leafStems.has(w)) (score += 3 * idf(w)), hit++
      else if (upperStems.has(w)) (score += 1.5 * idf(w)), hit++
      else if (titleStems.has(w)) (score += titleWeight * idf(w)), hit++
    }
    if (hit === 0) continue
    score = score / Math.sqrt(own.length)
    for (const w of above) if (leafStems.has(w) || upperStems.has(w)) score += 0.4
    if (preferredRoots.has(chain[0]?.id)) score += 1
    // "Inna elektronika" only when nothing specific fits
    if (/^inn/.test(normalize(leaf.name))) score *= 0.4

    if (!best || score > best.score) best = { id: leaf.id, score }
  }
  return best && best.score >= 1.5 ? best.id : null
}
