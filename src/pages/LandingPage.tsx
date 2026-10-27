import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { CategoryBrowse } from '../components/CategoryBrowse'
import type { Auction, Category } from '../lib/database.types'
import { formatCountdown, formatEndsAt, formatPln, ofertLabel } from '../lib/format'
import { isPromoted } from '../lib/promotions'
import { AUCTION_CARD_COLUMNS, supabase } from '../lib/supabase'

type LiveFilter = 'all' | 'bid' | 'buy'

type DemoAuction = Auction & { buyNowOnly?: boolean }

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString()
}

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
  ]
}

function HomeAuctionCard({ auction, demo }: { auction: DemoAuction; demo?: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const buyNowOnly = Boolean(auction.buyNowOnly || (auction.buy_now_price != null && auction.bid_count === 0 && auction.current_price === auction.buy_now_price))
  const img = auction.image_urls?.[0]
  const to = demo ? '/auctions?all=1' : `/auction/${auction.id}`

  return (
    <article className="bg-card">
      <Link to={to} className="bg-card-media">
        {img ? <img src={img} alt="" loading="lazy" /> : <div className="bg-card-ph" />}
        <span className={`bg-badge ${buyNowOnly ? 'is-buy' : 'is-bid'}`}>
          {buyNowOnly ? '✓ Kup teraz' : '🔨 Licytacja'}
        </span>
        {!demo && isPromoted(auction, now) && <span className="promoted-badge bg-card-promoted">Promowane</span>}
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
          <strong>{formatPln(auction.current_price)}</strong>
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

export function LandingPage() {
  const [featured, setFeatured] = useState<DemoAuction[]>([])
  // Paid "Strona główna" promotions (bidigo-backend V41), rotating
  const [promoted, setPromoted] = useState<Auction[]>([])
  const [categories, setCategories] = useState<Category[]>(cachedCategories)
  const [usingDemo, setUsingDemo] = useState(false)
  const [filter, setFilter] = useState<LiveFilter>('all')

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
        .select(AUCTION_CARD_COLUMNS)
        .eq('status', 'active')
        .eq('moderation_status', 'approved')
        .order('ends_at', { ascending: true })
        .limit(6)
      const live = (data as unknown as Auction[]) ?? []
      if (live.length > 0) {
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

  const visible = useMemo(() => {
    if (filter === 'all') return featured
    if (filter === 'buy') {
      return featured.filter((a) => a.buyNowOnly || a.buy_now_price != null)
    }
    return featured.filter((a) => !a.buyNowOnly)
  }, [featured, filter])

  return (
    <div className="bidigo-home">
      <section className="bg-hero">
        <div className="container bg-hero-inner">
          <h1 className="bg-hero-brand">
            bidigo<span className="bidigo-dot">.</span>
          </h1>
          <p className="bg-hero-claim">
            Bid smarter. <em>Win bigger.</em>
          </p>
          <p className="bg-hero-tagline">Global marketplace. Local deals. Live auctions.</p>
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

      {promoted.length > 0 && (
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
          <header className="bg-live-head">
            <div>
              <p className="bg-eyebrow">
                <span className="bidigo-dot-inline" /> Warto mieć na oku
              </p>
              <h2>Na żywo. Na Twoich zasadach.</h2>
            </div>
            <Link to="/auctions?all=1" className="bg-link-arrow">
              Wszystkie aukcje →
            </Link>
          </header>

          <div className="bg-live-tabs">
            <div className="bg-tabs" role="tablist">
              {(
                [
                  ['all', 'Wszystkie'],
                  ['bid', 'Licytacje'],
                  ['buy', 'Kup teraz'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  className={filter === id ? 'is-active' : ''}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {usingDemo && <span className="bg-demo-label">Przykładowe oferty</span>}
          </div>

          <div className="bg-cards">
            {visible.map((a) => (
              <HomeAuctionCard key={a.id} auction={a} demo={usingDemo} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-section bg-about" id="o-nas">
        <div className="container bg-about-inner">
          <header className="bg-section-head">
            <p className="bg-eyebrow muted">O nas</p>
            <h2>Bo nie wiedzieliśmy, ile to warte</h2>
          </header>
          <div className="bg-about-copy">
            <p>
              Mieliśmy rzeczy, których już nie potrzebowaliśmy — a ktoś inny pewnie by się
              ucieszył. Problem w tym, że nie wiedzieliśmy, na ile to wycenić. Na zwykłym
              ogłoszeniu ustawiasz cenę „na oko”, potem ktoś boi się napisać albo od razu
              proponuje połowę. Ty tylko chcesz się pozbyć sprzętu, a wychodzi targowanie się
              o grosze albo cisza w skrzynce.
            </p>
            <p>
              Nie znaleźliśmy aplikacji, która to ogarnia po ludzku: wystawiasz, licytacja sama
              pokazuje, ile ktoś naprawdę jest gotów zapłacić, a Ty nie musisz zgadywać ceny
              startowej w ciemno. Dlatego powstało Bidigo — proste aukcje, jasna prowizja,
              dogadywanie odbioru bez zbędnego szumu.
            </p>
            <p>
              Budujemy to w Polsce, pod realne rzeczy z mieszkania i garażu. Bez obietnic
              rewolucji — z miejscem, w którym uczciwa oferta ma szansę trafić do kogoś, komu
              ta rzecz naprawdę się przyda.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-section" id="jak-dziala">
        <div className="container">
          <header className="bg-section-head row">
            <div>
              <p className="bg-eyebrow muted">Prosto od pierwszego kroku</p>
              <h2>Jak to działa?</h2>
            </div>
            <p className="bg-section-aside">Ty decydujesz. My łączymy.</p>
          </header>
          <div className="bg-steps">
            <article className="bg-step">
              <span className="bg-step-num" aria-hidden>
                01
              </span>
              <span className="bg-step-icon" aria-hidden>
                +
              </span>
              <h3>Wystaw</h3>
              <p>Zrób zdjęcia, dodaj opis i ustal cenę. Licytacja czy Kup teraz? Wybór należy do Ciebie.</p>
            </article>
            <article className="bg-step">
              <span className="bg-step-num" aria-hidden>
                02
              </span>
              <span className="bg-step-icon" aria-hidden>
                🔨
              </span>
              <h3>Licytuj</h3>
              <p>Znajdź coś dla siebie i złóż ofertę. Obserwuj licytację lub kup bez czekania.</p>
            </article>
            <article className="bg-step">
              <span className="bg-step-num" aria-hidden>
                03
              </span>
              <span className="bg-step-icon" aria-hidden>
                💬
              </span>
              <h3>Dogadaj odbiór</h3>
              <p>Ustal ze sprzedającym dostawę lub odbiór osobisty. I daj rzeczom nowy początek.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-cta">
        <div className="container bg-cta-inner">
          <div>
            <p className="bg-eyebrow light">Mniej rzeczy. Więcej możliwości.</p>
            <h2>Masz coś do sprzedania?</h2>
            <p>Daj temu drugie życie. Prowizja 3–5% (min. 2 zł).</p>
          </div>
          <Link to="/sell" className="btn bg-cta-btn">
            Wystaw przedmiot +
          </Link>
        </div>
      </section>
    </div>
  )
}
