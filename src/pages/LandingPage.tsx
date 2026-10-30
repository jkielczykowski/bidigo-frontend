import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CategoryBrowse } from '../components/CategoryBrowse'
import { HowItWorks } from '../components/HowItWorks'
import { SearchBar } from '../components/SearchBar'
import {
  getInterests,
  removeInterest,
  subscribeInterests,
  type Interest,
} from '../lib/interests'
import {
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  subscribeRecentSearches,
} from '../lib/recentSearches'
import type { Auction, Category } from '../lib/database.types'
import { formatCountdown, formatEndsAt, formatPln, ofertLabel } from '../lib/format'
import { usePromotionsEnabled } from '../lib/features'
import { isPromoted } from '../lib/promotions'
import { AUCTION_CARD_COLUMNS, supabase } from '../lib/supabase'

type DemoAuction = Auction & { buyNowOnly?: boolean }

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString()
}

const images = [
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
  'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&q=80',
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
  'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&q=80',
  'https://images.unsplash.com/photo-1485965120184-e324d70ff711?w=800&q=80',
  'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80',
]

// [title, price, bids, hours left, city, image index, category, buy now only]
const EXTRA_DEMO: [string, number, number, number, string, number, string, boolean][] = [
  ['Aparat analogowy, w pełni sprawny', 240, 12, 0.6, 'Kraków', 0, 'Foto i optyka', false],
  ['Zestaw płyt winylowych', 95, 18, 0.9, 'Gdańsk', 3, 'Muzyka i instrumenty', false],
  ['Kurtka skórzana, rozmiar M', 310, 9, 11, 'Wrocław', 2, 'Odzież i akcesoria', true],
  ['Biurko drewniane, loft', 220, 3, 22, 'Katowice', 1, 'Dom i mieszkanie', true],
  ['Rower górski 29"', 780, 7, 26, 'Poznań', 4, 'Sport i wypoczynek', true],
  ['Konsola do gier z dwoma padami', 650, 11, 4, 'Warszawa', 5, 'Gry i konsole', false],
]

function mockAuctions(): DemoAuction[] {
  const base = {
    seller_id: 'demo',
    description: '',
    starting_price: 50,
    reserve_price: null,
    bid_increment: 10,
    status: 'active' as const,
    starts_at: new Date().toISOString(),
    winner_id: null,
    shipping_options: ['odbior'],
    watch_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    moderation_status: 'approved' as const,
  }
  return [
    {
      ...base,
      id: 'demo-1',
      category_id: 'foto',
      title: 'Fujifilm X-T30 II + obiektyw 15-45 mm',
      current_price: 1850,
      buy_now_price: null,
      city: 'Warszawa',
      bid_count: 12,
      ends_at: hoursFromNow(2.2),
      image_urls: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80'],
      category: { id: 'foto', name: 'Foto i optyka', icon: null },
    },
    {
      ...base,
      id: 'demo-2',
      category_id: 'dom',
      title: 'Fotel wypoczynkowy, szałwiowa zieleń',
      current_price: 420,
      buy_now_price: null,
      city: 'Kraków',
      bid_count: 5,
      ends_at: hoursFromNow(5.5),
      image_urls: ['https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&q=80'],
      category: { id: 'dom', name: 'Dom i mieszkanie', icon: null },
    },
    {
      ...base,
      id: 'demo-3',
      category_id: 'moda',
      title: 'Adidas Stan Smith — białe, rozm. 42',
      current_price: 210,
      buy_now_price: null,
      city: 'Wrocław',
      bid_count: 8,
      ends_at: hoursFromNow(8),
      image_urls: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80'],
      category: { id: 'moda', name: 'Odzież i akcesoria', icon: null },
    },
    {
      ...base,
      id: 'demo-4',
      category_id: 'muzyka',
      title: 'Płyta winylowa — klasyka jazzu',
      current_price: 85,
      buy_now_price: null,
      city: 'Poznań',
      bid_count: 6,
      ends_at: hoursFromNow(3.4),
      image_urls: ['https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&q=80'],
      category: { id: 'muzyka', name: 'Muzyka i instrumenty', icon: null },
    },
    {
      ...base,
      id: 'demo-5',
      category_id: 'sport',
      title: 'Rower miejski 28", gotowy na drogę',
      current_price: 590,
      buy_now_price: 590,
      buyNowOnly: true,
      city: 'Gdańsk',
      bid_count: 0,
      ends_at: hoursFromNow(48),
      image_urls: ['https://images.unsplash.com/photo-1485965120184-e324d70ff711?w=800&q=80'],
      category: { id: 'sport', name: 'Sport i wypoczynek', icon: null },
    },
    {
      ...base,
      id: 'demo-6',
      category_id: 'gry',
      title: 'PlayStation 5 z kontrolerem DualSense',
      current_price: 1250,
      buy_now_price: null,
      city: 'Łódź',
      bid_count: 19,
      ends_at: hoursFromNow(1.9),
      image_urls: ['https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80'],
      category: { id: 'gry', name: 'Gry i konsole', icon: null },
    },
    ...EXTRA_DEMO.map(([title, price, bids, hours, city, img, cat, buy], i) => ({
      ...base,
      id: `demo-x${i}`,
      category_id: 'demo',
      title,
      current_price: price,
      starting_price: price < 100 ? 1 : 50,
      buy_now_price: buy ? price : null,
      buyNowOnly: Boolean(buy),
      city,
      bid_count: bids,
      ends_at: hoursFromNow(hours),
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
      image_urls: [images[img]],
      category: { id: 'demo', name: cat, icon: null },
    })),
  ]
}

function HomeAuctionCard({
  auction,
  demo,
  bumpKey,
  isNew,
}: {
  auction: DemoAuction
  demo?: boolean
  bumpKey?: number
  isNew?: boolean
}) {
  const promotionsOn = usePromotionsEnabled()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const buyNowOnly = Boolean(auction.buyNowOnly || (auction.buy_now_price != null && auction.bid_count === 0 && auction.current_price === auction.buy_now_price))
  const img = auction.image_urls?.[0]
  const to = demo ? '/auctions?all=1' : `/auction/${auction.id}`

  return (
    <article className={`bg-card${bumpKey ? ' is-bump' : ''}`} key={bumpKey}>
      <Link to={to} className="bg-card-media">
        {img ? <img src={img} alt="" loading="lazy" /> : <div className="bg-card-ph" />}
        {isNew && <span className="bg-new">Nowość</span>}
        <span className={`bg-badge ${buyNowOnly ? 'is-buy' : 'is-bid'}`}>
          {buyNowOnly ? '✓ Kup teraz' : '🔨 Licytacja'}
        </span>
        {promotionsOn && !demo && isPromoted(auction, now) && <span className="promoted-badge bg-card-promoted">Promowane</span>}
        <span className="bg-heart" aria-hidden>
          ♡
        </span>
      </Link>
      <div className="bg-card-body">
        <p className="bg-card-cat">{auction.category?.name || 'Aukcja'}</p>
        <h3>
          <Link to={to}>{auction.title}</Link>
        </h3>
        <div className="bg-card-price-row">
          <strong key={bumpKey}>{formatPln(auction.current_price)}</strong>
          <span>{buyNowOnly ? 'cena zakupu' : ofertLabel(auction.bid_count)}</span>
        </div>
        <div className="bg-card-meta">
          <span className={buyNowOnly ? '' : 'is-urgent'}>
            {buyNowOnly ? (
              'Dostępny od ręki'
            ) : (
              <>
                ⏱ {formatCountdown(auction.ends_at, now)}
                <span className="bg-card-ends"> · do {formatEndsAt(auction.ends_at, now)}</span>
              </>
            )}
          </span>
          <span>📍 {auction.city || 'Polska'}</span>
        </div>
        <Link to={to} className={buyNowOnly ? 'btn bg-card-btn outline' : 'btn bg-card-btn'}>
          {buyNowOnly ? 'Zobacz ofertę' : '🔨 Licytuj'}
        </Link>
      </div>
    </article>
  )
}

type LiveTab = 'end' | 'pop' | 'new' | 'one' | 'buy'

const LIVE_TABS: { id: LiveTab; icon: string; label: string }[] = [
  { id: 'end', icon: '⏱️', label: 'Kończą się za chwilę' },
  { id: 'pop', icon: '🔥', label: 'Popularne' },
  { id: 'new', icon: '✨', label: 'Nowości' },
  { id: 'one', icon: '🏷️', label: 'Od 1 zł' },
  { id: 'buy', icon: '🛒', label: 'Kup teraz' },
]

type RailRow = { id: string; title: string; items: DemoAuction[] }

function Rail({
  row,
  demo,
  bump,
  fresh,
}: {
  row: RailRow
  demo: boolean
  bump: { id: string; nonce: number } | null
  fresh: Set<string>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => {
    const el = ref.current
    const card = el?.firstElementChild as HTMLElement | null
    if (!el || !card) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    el.scrollBy({ left: dir * (card.offsetWidth + 16), behavior })
  }
  return (
    <section className="bg-rail-section" id={row.id} aria-labelledby={`${row.id}-h`}>
      <header className="bg-rail-head">
        <h3 id={`${row.id}-h`}>{row.title}</h3>
        <div className="bg-rail-ctl">
          <Link to="/auctions?all=1" className="bg-link-arrow">
            Wszystkie →
          </Link>
          <button type="button" aria-label={`Poprzednie: ${row.title}`} onClick={() => scroll(-1)}>
            ‹
          </button>
          <button type="button" aria-label={`Następne: ${row.title}`} onClick={() => scroll(1)}>
            ›
          </button>
        </div>
      </header>
      <div
        ref={ref}
        className="bg-rail"
        tabIndex={0}
        role="region"
        aria-label={`${row.title} – użyj strzałek, aby przewijać`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            scroll(e.key === 'ArrowRight' ? 1 : -1)
          }
        }}
      >
        {row.items.map((a) => (
          <HomeAuctionCard key={a.id} auction={a} demo={demo} bumpKey={bump?.id === a.id ? bump.nonce : undefined} isNew={fresh.has(a.id)} />
        ))}
      </div>
    </section>
  )
}

const WHY_SELL = [
  { icon: '⏱️', title: '2 minuty na ofertę', text: 'Zdjęcia, opis, cena. Bez długich formularzy.' },
  { icon: '🔨', title: 'Cenę ustala rynek', text: 'Nie zgadujesz wartości. Licytacja pokazuje, ile ktoś jest gotów zapłacić.' },
  { icon: '🧾', title: 'Jasna prowizja', text: 'Koszty widzisz, zanim opublikujesz ofertę.' },
  { icon: '🤝', title: 'Odbiór bez zbędnego szumu', text: 'Dostawę lub odbiór osobisty ustalasz bezpośrednio z drugą stroną.' },
]

const FAQ = [
  [
    'Czy wystawianie aukcji jest płatne?',
    'Wystawianie jest bezpłatne. Prowizję naliczamy dopiero po udanej sprzedaży, a jej stawkę widać przy wystawianiu aukcji.',
  ],
  [
    'Czym różni się licytacja od „Kup teraz”?',
    'W licytacji wygrywa najwyższa oferta po zakończeniu odliczania. „Kup teraz” pozwala kupić od razu po stałej cenie.',
  ],
  ['Jak wystawić przedmiot?', 'Kliknij „Wystaw przedmiot”, dodaj zdjęcia i opis, ustal cenę i opublikuj aukcję.'],
  ['Jak wygląda odbiór lub dostawa?', 'Ustalasz je bezpośrednio ze sprzedającym w wiadomościach.'],
  [
    'Skąd mam wiedzieć, jaką cenę ustawić?',
    'Ustaw niską cenę startową. Licytacja pokaże, ile ktoś naprawdę jest gotów zapłacić.',
  ],
  ['Jak usunąć konto?', 'Skorzystaj ze strony „Usuń konto” albo napisz do nas przez Centrum pomocy.'],
] as const

const SEARCH_HINTS = ['Czego szukasz?', 'Np. rower miejski', 'Np. aparat analogowy', 'Np. klocki LEGO', 'Np. konsola do gier']
const DEFAULT_SUGGESTIONS = ['LEGO', 'Rower', 'Konsola']

// Categories barely change: show the last known list at once, refresh it in the background
const CATEGORIES_CACHE_KEY = 'bidigo:categories:v1'

function cachedCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Category[]) : []
  } catch {
    return []
  }
}

const DEMO_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'

export function LandingPage() {
  const [featured, setFeatured] = useState<DemoAuction[]>([])
  // Paid "Strona główna" promotions (bidigo-backend V41), rotating
  const [promoted, setPromoted] = useState<Auction[]>([])
  const promotionsOn = usePromotionsEnabled()
  const [categories, setCategories] = useState<Category[]>(cachedCategories)
  const [usingDemo, setUsingDemo] = useState(false)
  const [recents, setRecents] = useState<string[]>(getRecentSearches)
  const [hint, setHint] = useState(0)

  // The search placeholder cycles through example queries (static for reduced motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setHint((h) => (h + 1) % SEARCH_HINTS.length), 2800)
    return () => clearInterval(t)
  }, [])
  const [forYou, setForYou] = useState<Auction[]>([])

  useEffect(() => subscribeRecentSearches(() => setRecents(getRecentSearches())), [])

  // Interest profile (categories you keep looking at) -> "Dla Ciebie" rails that refresh on their own
  const [interests, setInterests] = useState<Interest[]>(getInterests)
  const [mine, setMine] = useState<Record<string, Auction[]>>({})
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const [liveToast, setLiveToast] = useState<{ key: number; title: string; sub: string } | null>(null)
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => subscribeInterests(() => setInterests(getInterests())), [])

  const topInterests = useMemo(() => interests.slice(0, 2), [interests])
  const interestKey = topInterests.map((i) => i.id).join('|')

  useEffect(() => {
    if (!interestKey) {
      setMine({})
      return
    }
    seen.current = new Set()
    let cancelled = false
    let toastTimer: ReturnType<typeof setTimeout> | undefined

    // The chosen category plus everything below it
    const withChildren = (id: string) => {
      const ids = new Set([id])
      let grew = true
      while (grew) {
        grew = false
        for (const c of categories) {
          if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
            ids.add(c.id)
            grew = true
          }
        }
      }
      return [...ids]
    }

    const load = async (polling: boolean) => {
      const out: Record<string, Auction[]> = {}
      const added: { a: Auction; cat: string }[] = []
      for (const it of interestKey.split('|')) {
        const { data } = await supabase
          .from('auctions')
          .select(AUCTION_CARD_COLUMNS)
          .eq('status', 'active')
          .eq('moderation_status', 'approved')
          .in('category_id', withChildren(it))
          .order('ends_at', { ascending: true })
          .limit(12)
        const list = (data as unknown as Auction[]) ?? []
        out[it] = list
        for (const a of list) {
          if (!seen.current.has(a.id)) {
            seen.current.add(a.id)
            if (polling) added.push({ a, cat: interests.find((i) => i.id === it)?.name ?? '' })
          }
        }
      }
      if (cancelled) return
      setMine(out)
      if (added.length > 0) {
        setFresh((prev) => new Set([...prev, ...added.map((x) => x.a.id)]))
        setLiveToast({ key: Date.now(), title: `Nowa aukcja: ${added[0].cat}`, sub: added[0].a.title })
        toastTimer = setTimeout(() => setLiveToast(null), 3200)
      }
    }

    void load(false)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, 45_000)
    return () => {
      cancelled = true
      clearInterval(timer)
      if (toastTimer) clearTimeout(toastTimer)
    }
    // topInterests names are only read for the toast text; re-run when the set of categories or the tree changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestKey, categories])

  // "Based on your searches": active auctions whose title matches one of the last searches
  const recentKey = recents.slice(0, 3).join('|')
  useEffect(() => {
    const terms = recentKey
      .split('|')
      .map((t) => t.replace(/[^\p{L}\p{N} ]/gu, ' ').trim())
      .filter((t) => t.length >= 2)
    if (terms.length === 0) {
      setForYou([])
      return
    }
    let cancelled = false
    void supabase
      .from('auctions')
      .select(AUCTION_CARD_COLUMNS)
      .eq('status', 'active')
      .eq('moderation_status', 'approved')
      .or(terms.map((t) => `title.ilike.%${t}%`).join(','))
      .order('ends_at', { ascending: true })
      .limit(12)
      .then(({ data }) => {
        if (!cancelled) setForYou((data as unknown as Auction[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [recentKey])

  useEffect(() => {
    document.body.classList.add('on-home')
    return () => document.body.classList.remove('on-home')
  }, [])

  // Independent of the auctions below
  useEffect(() => {
    void supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (!data) return
        setCategories(data as Category[])
        try {
          localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(data))
        } catch {
          // storage full / blocked: the list just loads from the network next time
        }
      })
  }, [])

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('auctions')
        .select(`${AUCTION_CARD_COLUMNS}, created_at`)
        .eq('status', 'active')
        .eq('moderation_status', 'approved')
        .order('ends_at', { ascending: true })
        .limit(24)
      const live = (data as unknown as Auction[]) ?? []
      if (live.length > 0 && !DEMO_MODE) {
        setFeatured(live)
        setUsingDemo(false)
      } else {
        setFeatured(mockAuctions())
        setUsingDemo(true)
      }
    })()
  }, [])

  useEffect(() => {
    void supabase
      .rpc('homepage_promoted_auctions', { p_limit: 8 })
      .select(AUCTION_CARD_COLUMNS)
      .then(({ data }) => setPromoted((data as unknown as Auction[]) ?? []))
  }, [])

  // Rails built from what this visitor looked at / searched for
  const personalRows = useMemo<RailRow[]>(() => {
    const byInterest: RailRow[] = topInterests
      .filter((i) => (mine[i.id]?.length ?? 0) > 0)
      .map((i) => ({ id: `dla-ciebie-${i.id}`, title: `Dla Ciebie: ${i.name}`, items: mine[i.id] }))
    const byTerms: RailRow[] =
      forYou.length > 0 ? [{ id: 'dla-ciebie', title: 'Na podstawie Twoich wyszukiwań', items: forYou }] : []
    return [...byInterest, ...byTerms]
  }, [forYou, mine, topInterests])

  // Tabs over the live auctions: each one is a different cut of the same list
  const [tab, setTab] = useState<LiveTab>('end')
  const tabItems = useMemo(() => {
    const list = [...featured]
    switch (tab) {
      case 'pop':
        return list.filter((a) => a.bid_count > 0).sort((a, b) => b.bid_count - a.bid_count)
      case 'new':
        return list.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      case 'one':
        return list.filter((a) => a.starting_price <= 1)
      case 'buy':
        return list.filter((a) => a.buyNowOnly || a.buy_now_price != null)
      default:
        return list.sort((a, b) => a.ends_at.localeCompare(b.ends_at))
    }
  }, [featured, tab])
  const tabLabel = LIVE_TABS.find((t) => t.id === tab)?.label ?? ''
  const navigate = useNavigate()

  // "W mojej okolicy": the auction list around the visitor's position (50 km), or everything if location is refused
  const showNearby = () => {
    const all = '/auctions?all=1'
    if (!navigator.geolocation) {
      navigate(all)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => navigate(`${all}&lat=${pos.coords.latitude.toFixed(4)}&lng=${pos.coords.longitude.toFixed(4)}&promien=50`),
      () => navigate(all),
      { timeout: 6000 },
    )
  }

  // ?demo=1 preview only: simulate new bids so the page shows how it feels with live traffic
  const [bump, setBump] = useState<{ id: string; nonce: number } | null>(null)
  useEffect(() => {
    if (!DEMO_MODE || featured.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      const pool = featured.filter((a) => !a.buyNowOnly)
      const pick = pool[Math.floor(Math.random() * pool.length)]
      if (pick) {
        const step = pick.current_price < 100 ? 5 : pick.current_price < 500 ? 10 : 20
        setFeatured((prev) =>
          prev.map((a) => (a.id === pick.id ? { ...a, current_price: a.current_price + step, bid_count: a.bid_count + 1 } : a)),
        )
        setBump({ id: pick.id, nonce: Date.now() })
      }
      t = setTimeout(tick, 3800 + Math.random() * 2500)
    }
    t = setTimeout(tick, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured.length])

  return (
    <div className="bidigo-home">
      <section className="bg-hero">
        <div className="container bg-hero-inner">
          <h1 className="bg-hero-brand">
            bidigo<span className="bidigo-dot">.</span>
          </h1>
          <h2 className="bg-hero-claim">
            Licytuj, kupuj, sprzedawaj. <em>Wszystko w jednym miejscu.</em>
          </h2>
          <p className="bg-hero-tagline">Aukcje z całej Polski. Lokalne okazje. Licytacje na żywo.</p>
          <div className="bg-hero-search">
            <SearchBar variant="hero" placeholder={SEARCH_HINTS[hint]} />
            <p className="bg-hero-suggest">
              <span>{recents.length > 0 ? 'Ostatnio:' : 'Popularne:'}</span>
              {(recents.length > 0 ? recents.slice(0, 4) : DEFAULT_SUGGESTIONS).map((t) => (
                <Link key={t} to={`/auctions?q=${encodeURIComponent(t)}`}>
                  {t}
                </Link>
              ))}
            </p>
          </div>
          <div className="bg-hero-ctas">
            <Link to="/auctions?all=1" className="bg-hero-btn is-primary">
              Przeglądaj aukcje
            </Link>
            <Link to="/sell" className="bg-hero-btn">
              Wystaw przedmiot
            </Link>
          </div>
          <ul className="bg-hero-perks">
            <li>Licytacja albo „Kup teraz”</li>
            <li>Oferta w 2 minuty</li>
            <li>Jasna prowizja</li>
          </ul>
        </div>
      </section>

      <section className="bg-section">
        <div className="container">
          <header className="bg-section-head center">
            <h2>Kategorie główne</h2>
          </header>
          <CategoryBrowse categories={categories} variant="hub" />
        </div>
      </section>

      {promotionsOn && promoted.length > 0 && (
        <section className="bg-section bg-promoted" aria-labelledby="home-promoted">
          <div className="container">
            <header className="bg-live-head">
              <div>
                <p className="bg-eyebrow">
                  <span className="bidigo-dot-inline" /> Wyróżnione przez sprzedających
                </p>
                <h2 id="home-promoted">Promowane</h2>
              </div>
            </header>
            <div className="bg-cards">
              {promoted.map((a) => (
                <HomeAuctionCard key={a.id} auction={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-section bg-live">
        <div className="container">
          {interests.length > 0 && (
            <div className="bg-recent" aria-label="Twoje zainteresowania">
              <span className="bg-recent-label">Twoje zainteresowania:</span>
              {interests.slice(0, 4).map((i) => (
                <span key={i.id} className="bg-recent-chip">
                  <Link to={`/auctions?cat=${encodeURIComponent(i.id)}`}>{i.name}</Link>
                  <button type="button" aria-label={`Przestań polecać: ${i.name}`} onClick={() => removeInterest(i.id)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {recents.length > 0 && (
            <div className="bg-recent" aria-label="Ostatnio szukane">
              <span className="bg-recent-label">Ostatnio szukane:</span>
              {recents.slice(0, 5).map((t) => (
                <span key={t} className="bg-recent-chip">
                  <Link to={`/auctions?q=${encodeURIComponent(t)}`}>{t}</Link>
                  <button type="button" aria-label={`Usuń „${t}” z historii`} onClick={() => removeRecentSearch(t)}>
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="bg-recent-clear" onClick={() => clearRecentSearches()}>
                Wyczyść
              </button>
            </div>
          )}
          {usingDemo && <span className="bg-demo-label">Przykładowe oferty</span>}

          {personalRows.map((r) => (
            <Rail key={r.id} row={r} demo={usingDemo} bump={bump} fresh={fresh} />
          ))}

          <div className="bg-quick" role="tablist" aria-label="Rodzaj aukcji">
            {LIVE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'is-active' : ''}
                onClick={() => setTab(t.id)}
              >
                <span aria-hidden>{t.icon}</span> {t.label}
              </button>
            ))}
            <button type="button" onClick={showNearby}>
              <span aria-hidden>📍</span> W mojej okolicy
            </button>
          </div>
          {tabItems.length > 0 ? (
            <Rail row={{ id: 'oferty', title: tabLabel, items: tabItems }} demo={usingDemo} bump={bump} fresh={fresh} />
          ) : (
            <p className="bg-rail-empty">
              Na razie brak takich aukcji. <Link to="/auctions?all=1">Zobacz wszystkie aukcje →</Link>
            </p>
          )}
        </div>
      </section>

      <section className="bg-section" aria-labelledby="why-sell">
        <div className="container">
          <header className="bg-section-head">
            <h2 id="why-sell">Dlaczego warto wystawić coś na Bidigo</h2>
          </header>
          <div className="bg-why">
            {WHY_SELL.map((w) => (
              <article key={w.title} className="bg-why-card">
                <span className="bg-why-icon" aria-hidden>
                  {w.icon}
                </span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </article>
            ))}
          </div>
          <Link to="/sell" className="bg-hero-btn is-primary bg-why-btn">
            Wystaw przedmiot
          </Link>
        </div>
      </section>

      <section className="bg-section" id="jak-dziala">
        <div className="container">
          <header className="bg-section-head row">
            <div>
              <h2>Jak to działa</h2>
            </div>
          </header>
          <HowItWorks />
        </div>
      </section>

      {liveToast && !(DEMO_MODE && bump) && (
        <div key={liveToast.key} className="bg-toast" role="status">
          <span className="bg-toast-ic">✨</span>
          <span>
            <b>{liveToast.title}</b>
            {liveToast.sub}
          </span>
        </div>
      )}

      {DEMO_MODE && bump && (
        <div key={bump.nonce} className="bg-toast" aria-hidden>
          <span className="bg-toast-ic">🔔</span>
          <span>
            <b>Nowa oferta: {formatPln(featured.find((a) => a.id === bump.id)?.current_price ?? 0)}</b>
            {featured.find((a) => a.id === bump.id)?.title}
          </span>
        </div>
      )}

      <section className="bg-cta">
        <div className="container bg-cta-inner">
          <div>
            <h2>Sprzedaj w 2 minuty</h2>
            <p>Nie wiesz, ile to warte? Ustaw niską cenę startową, a licytacja pokaże wartość. Możesz też wybrać „Kup teraz”. Prowizja 3–5% (min. 2 zł).</p>
          </div>
          <Link to="/sell" className="btn bg-cta-btn">
            Wystaw przedmiot +
          </Link>
        </div>
      </section>

      <section className="bg-section" id="faq" aria-labelledby="faq-h">
        <div className="container bg-faq">
          <header className="bg-section-head">
            <h2 id="faq-h">Najczęstsze pytania</h2>
          </header>
          {FAQ.map(([q, a]) => (
            <details key={q} className="bg-faq-item">
              <summary>{q}</summary>
              <p>
                {a}
                {q === 'Jak usunąć konto?' && (
                  <>
                    {' '}
                    <Link to="/usun-konto">Przejdź do usuwania konta →</Link>
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
