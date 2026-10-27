import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuctionCard } from '../components/AuctionCard'
import { CategoryBrowse } from '../components/CategoryBrowse'
import { CategoryIcon } from '../components/CategoryIcons'
import { CitySuggest } from '../components/CitySuggest'
import { FilterMenu } from '../components/FilterMenu'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import type { Auction, Category } from '../lib/database.types'
import { geocodeCity } from '../lib/cities'
import { fetchSearch } from '../lib/searchApi'
import { AUCTION_CARD_COLUMNS, supabase } from '../lib/supabase'

const PAGE_SIZE = 12
// FluffyTag-style radius options
const RADIUS_OPTIONS = [
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
  { value: '100', label: '100 km' },
]

function pathChain(categories: Category[], id: string): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const chain: Category[] = []
  let cur = byId.get(id)
  while (cur) {
    chain.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return chain
}

type SortKey = 'ending' | 'newest' | 'price_asc' | 'price_desc' | 'distance'

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const category = params.get('cat') || params.get('kat') || 'all'
  const page = Math.max(1, Number(params.get('page') || '1') || 1)
  const priceFrom = params.get('od') || ''
  const priceTo = params.get('do') || ''
  const city = params.get('miasto') || ''
  const lat = params.get('lat') || ''
  const lng = params.get('lng') || ''
  const radiusKm = params.get('promien') || ''
  const sort = (params.get('sort') as SortKey) || 'ending'
  const browseMode = category === 'all' && !q && !city && params.get('all') !== '1'

  const [auctions, setAuctions] = useState<Auction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cityDraft, setCityDraft] = useState(city)

  useEffect(() => {
    setCityDraft(city)
  }, [city])

  const tops = useMemo(() => categories.filter((c) => !c.parent_id), [categories])
  const chain = useMemo(
    () => (category === 'all' ? [] : pathChain(categories, category)),
    [categories, category],
  )
  const level1 = chain[0]?.id || ''
  const level2 = chain[1]?.id || ''
  const level3 = chain[2]?.id || ''

  const mids = useMemo(
    () => (level1 ? categories.filter((c) => c.parent_id === level1) : []),
    [categories, level1],
  )
  const leaves = useMemo(
    () => (level2 ? categories.filter((c) => c.parent_id === level2) : []),
    [categories, level2],
  )

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (loading || browseMode) return
    if (page > pageCount) {
      patchParams({ page: pageCount <= 1 ? null : String(pageCount) }, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp page when totals shrink
  }, [loading, browseMode, page, pageCount])

  const hasActiveFilters =
    category !== 'all' ||
    !!q ||
    !!priceFrom ||
    !!priceTo ||
    !!city ||
    !!radiusKm ||
    sort !== 'ending'

  useEffect(() => {
    void supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories((data as Category[]) ?? []))
  }, [])

  useEffect(() => {
    if (params.get('kat') && !params.get('cat')) {
      const next = new URLSearchParams(params)
      next.set('cat', params.get('kat')!)
      next.delete('kat')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  useEffect(() => {
    if (browseMode) {
      setAuctions([])
      setTotal(0)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const offset = (page - 1) * PAGE_SIZE
      try {
        let geoLat = lat
        let geoLng = lng
        const radius = radiusKm || (city.trim().length >= 2 ? '50' : '')

        if (city.trim().length >= 2 && radius && (!geoLat || !geoLng)) {
          const place = await geocodeCity(city.trim())
          if (place) {
            geoLat = String(place.lat)
            geoLng = String(place.lng)
          }
        }

        let ids: string[] = []
        let total = 0

        try {
          const os = await fetchSearch({
            q: q || undefined,
            category: category !== 'all' ? category : undefined,
            city: city.trim().length >= 2 ? city.trim() : undefined,
            lat: geoLat || undefined,
            lng: geoLng || undefined,
            radiusKm: radius || undefined,
            priceFrom: priceFrom || undefined,
            priceTo: priceTo || undefined,
            sort,
            limit: PAGE_SIZE,
            offset,
          })
          ids = os.ids?.length ? os.ids : os.hits.map((h) => h.id)
          total = os.total ?? 0
        } catch {
          // Fast fallback: Postgres geo RPC (same as mobile)
          if (geoLat && geoLng && radius) {
            const { data: near, error: nearErr } = await supabase.rpc('search_auctions_near', {
              p_lat: Number(geoLat),
              p_lng: Number(geoLng),
              p_radius_km: Number(radius),
              p_query: q || null,
              p_category_id: category !== 'all' ? category : null,
              p_price_from: priceFrom ? Number(priceFrom) : null,
              p_price_to: priceTo ? Number(priceTo) : null,
              p_sort: sort,
              p_limit: PAGE_SIZE,
              p_offset: offset,
            })
            if (nearErr) throw nearErr
            ids = ((near as { id: string }[]) ?? []).map((r) => r.id)
            // The page may also carry promotion slots on top (bidigo-backend V47): a full page means more
            total = Math.min(ids.length, PAGE_SIZE) + (ids.length >= PAGE_SIZE ? offset + PAGE_SIZE : offset)
          } else {
            throw new Error('Nie udało się wyszukać')
          }
        }

        if (cancelled) return
        setTotal(total)

        if (ids.length === 0) {
          setAuctions([])
          setLoading(false)
          return
        }

        const { data, error: err } = await supabase
          .from('auctions')
          .select(AUCTION_CARD_COLUMNS)
          .in('id', ids)

        if (cancelled) return
        if (err) {
          setError(err.message)
          setAuctions([])
        } else {
          const byId = new Map(((data as unknown as Auction[]) ?? []).map((a) => [a.id, a]))
          setAuctions(ids.map((id) => byId.get(id)).filter(Boolean) as Auction[])
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Nie udało się wyszukać')
        setAuctions([])
        setTotal(0)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [q, category, page, browseMode, priceFrom, priceTo, sort, city, lat, lng, radiusKm])

  function patchParams(patch: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(params)
    next.delete('foto')
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '' || v === 'all') next.delete(k)
      else next.set(k, v)
    }
    if (resetPage) next.delete('page')
    if (
      !next.get('cat') &&
      !next.get('q') &&
      !next.get('od') &&
      !next.get('do') &&
      !next.get('miasto')
    ) {
      next.set('all', '1')
    }
    setParams(next)
  }

  useEffect(() => {
    const next = cityDraft.trim()
    if (next === city) return
    if (next.length > 0 && next.length < 2) return
    const t = window.setTimeout(() => {
      // Typed city without picking — clear stale coords; geocode happens in load()
      patchParams({
        miasto: next || null,
        lat: null,
        lng: null,
        promien: next ? radiusKm || '50' : null,
      })
    }, 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce city URL only
  }, [cityDraft])

  function setCategory(id: string) {
    patchParams({ cat: id === 'all' ? null : id, all: id === 'all' ? '1' : null })
  }

  function setLevel1(id: string) {
    patchParams({ cat: id === 'all' ? null : id, all: id === 'all' ? '1' : null })
  }

  function setLevel2(id: string) {
    if (id === 'all') setCategory(level1 || 'all')
    else setCategory(id)
  }

  function setLevel3(id: string) {
    if (id === 'all') setCategory(level2 || level1 || 'all')
    else setCategory(id)
  }

  function clearFilters() {
    setParams({ all: '1' })
  }

  function setPage(p: number) {
    const next = Math.min(Math.max(1, p), pageCount)
    patchParams({ page: next <= 1 ? null : String(next) }, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedName = chain.map((c) => c.name).join(' / ') || 'Wszystkie'

  return (
    <div className="container page">
      <section className="page-hero auctions-hero">
        <div>
          <h1>
            Aukcje
            <span> na żywo</span>
          </h1>
          <p>
            {browseMode
              ? 'Wybierz kategorię, potem podkategorię — albo wpisz czego szukasz.'
              : 'Wyniki wyszukiwania. Filtrami zmienisz kategorię, miejscowość, cenę i sortowanie.'}
          </p>
        </div>
        <SearchBar initialQuery={q} />
      </section>

      {browseMode ? (
        <CategoryBrowse categories={categories} variant="hub" />
      ) : (
        <>
          <div className="card-filters" aria-label="Filtry">
            <div className="filter-row">
              <FilterMenu
                label="Kategoria"
                value={level1 || 'all'}
                options={tops.map((c) => ({
                  value: c.id,
                  label: c.name,
                  icon: <CategoryIcon id={c.id} name={c.name} />,
                }))}
                onChange={setLevel1}
              />

              <FilterMenu
                label="Podkategoria"
                value={level2 || 'all'}
                disabled={!level1 || mids.length === 0}
                options={mids.map((c) => ({
                  value: c.id,
                  label: c.name,
                  icon: <CategoryIcon id={c.id} name={c.name} />,
                }))}
                onChange={setLevel2}
              />

              {leaves.length > 0 && (
                <FilterMenu
                  label="Szczegóły"
                  value={level3 || 'all'}
                  options={leaves.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={setLevel3}
                />
              )}

              <div className="filter-field filter-city">
                <CitySuggest
                  compact
                  required={false}
                  label="Miejscowość"
                  placeholder="Cała Polska"
                  value={cityDraft}
                  onChange={setCityDraft}
                  onPlaceSelect={(place) => {
                    if (!place) return
                    setCityDraft(place.name)
                    patchParams({
                      miasto: place.name,
                      lat: String(place.lat),
                      lng: String(place.lng),
                      promien: radiusKm || '50',
                    })
                  }}
                />
              </div>

              <FilterMenu
                label="Promień"
                value={city ? radiusKm || '50' : 'all'}
                disabled={!city}
                showAllOption={false}
                options={
                  city
                    ? RADIUS_OPTIONS
                    : [{ value: 'all', label: 'Wybierz miasto' }]
                }
                onChange={(v) =>
                  patchParams({
                    promien: v === 'all' ? null : v,
                    ...(v !== 'all' && city && !lat ? {} : {}),
                  })
                }
              />

              <label className="filter-field filter-field-narrow">
                Cena od
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="zł"
                  value={priceFrom}
                  onChange={(e) => patchParams({ od: e.target.value || null })}
                />
              </label>

              <label className="filter-field filter-field-narrow">
                Cena do
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="zł"
                  value={priceTo}
                  onChange={(e) => patchParams({ do: e.target.value || null })}
                />
              </label>

              <FilterMenu
                label="Sortuj"
                value={sort}
                showAllOption={false}
                options={[
                  { value: 'ending', label: 'Kończące się wkrótce' },
                  { value: 'newest', label: 'Najnowsze' },
                  { value: 'price_asc', label: 'Cena: rosnąco' },
                  { value: 'price_desc', label: 'Cena: malejąco' },
                  ...(city
                    ? [{ value: 'distance', label: 'Najbliższe' } as const]
                    : []),
                ]}
                onChange={(v) => patchParams({ sort: v === 'ending' ? null : v })}
              />

              {hasActiveFilters && (
                <button type="button" className="btn btn-outline btn-sm filter-clear" onClick={clearFilters}>
                  Wyczyść filtry
                </button>
              )}
            </div>
          </div>

          <nav className="breadcrumb" aria-label="Ścieżka">
            <Link to="/auctions">Kategorie</Link>
            {chain.map((c, i) => (
              <span key={c.id}>
                <span className="crumb-sep">/</span>
                {i === chain.length - 1 ? (
                  <strong>{c.name}</strong>
                ) : (
                  <button type="button" className="crumb-link" onClick={() => setCategory(c.id)}>
                    {c.name}
                  </button>
                )}
              </span>
            ))}
            {city && (
              <span>
                <span className="crumb-sep">/</span>
                <strong>
                  {city}
                  {radiusKm || city ? ` · ${radiusKm || 50} km` : ''}
                </strong>
              </span>
            )}
            {q && (
              <span>
                <span className="crumb-sep">/</span>
                <strong>„{q}”</strong>
              </span>
            )}
          </nav>

          <div className="results-head">
            <h2>
              {loading
                ? 'Szukam…'
                : total === 0
                  ? 'Brak aukcji'
                  : `Znaleziono ${total} ${total === 1 ? 'aukcję' : total < 5 ? 'aukcje' : 'aukcji'}`}
            </h2>
            <p className="muted">
              {selectedName}
              {city ? ` · ${city}` : ''}
              {q ? ` · „${q}”` : ''}
              {' · '}
              <button type="button" className="crumb-link" onClick={() => setParams({})}>
                Wróć do kategorii
              </button>
            </p>
          </div>

          {error && <p className="error">{error}</p>}
          {!loading && !error && auctions.length === 0 && (
            <div className="empty">
              <h2>Nic nie znaleziono</h2>
              <p>Zmień kategorię, miejscowość lub filtry albo wystaw własną aukcję.</p>
              <div className="empty-actions">
                <button type="button" className="btn btn-outline" onClick={clearFilters}>
                  Wyczyść filtry
                </button>
                <Link to="/sell" className="btn btn-primary">
                  Wystaw aukcję
                </Link>
              </div>
            </div>
          )}

          <div className="auction-grid">
            {auctions.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>

          {!loading && total > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              onChange={setPage}
              className="pagination--bottom"
            />
          )}
        </>
      )}
    </div>
  )
}
