import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchSuggest, type SuggestAuction, type SuggestCategory } from '../lib/searchApi'
import { formatPln } from '../lib/format'
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  subscribeRecentSearches,
} from '../lib/recentSearches'

type SearchBarProps = {
  className?: string
  placeholder?: string
  initialQuery?: string
  compact?: boolean
  /** hero = big pill with Szukaj button; nav = slim pill with arrow */
  variant?: 'default' | 'hero' | 'nav'
}

type Highlight = { kind: 'category' | 'auction'; index: number }

export function SearchBar({
  className = '',
  placeholder = 'Czego szukasz?',
  initialQuery = '',
  compact = false,
  variant,
}: SearchBarProps) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(initialQuery || params.get('q') || '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<SuggestCategory[]>([])
  const [auctions, setAuctions] = useState<SuggestAuction[]>([])
  const [hi, setHi] = useState<Highlight | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [recents, setRecents] = useState<string[]>(getRecentSearches)
  const [forYou, setForYou] = useState<SuggestAuction[]>([])

  useEffect(() => subscribeRecentSearches(() => setRecents(getRecentSearches())), [])

  // Auctions matching the latest search, shown under the history ("based on what you looked for")
  const lastTerm = recents[0]
  useEffect(() => {
    if (!lastTerm) {
      setForYou([])
      return
    }
    const ctrl = new AbortController()
    void fetchSuggest(lastTerm, ctrl.signal)
      .then((d) => setForYou((d.auctions || []).slice(0, 3)))
      .catch(() => setForYou([]))
    return () => ctrl.abort()
  }, [lastTerm])
  const listId = useId()
  const mode = variant ?? (compact ? 'nav' : 'default')

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setCategories([])
      setAuctions([])
      setHi(null)
      return
    }

    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      setLoading(true)
      void fetchSuggest(query, ctrl.signal)
        .then((data) => {
          setCategories(data.categories || [])
          setAuctions(data.auctions || [])
          setOpen(true)
          setHi(null)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setCategories([])
          setAuctions([])
        })
        .finally(() => setLoading(false))
    }, 200)

    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function goSearch(query: string) {
    const next = new URLSearchParams()
    const trimmed = query.trim()
    addRecentSearch(trimmed)
    if (trimmed) next.set('q', trimmed)
    else if (!params.get('cat') && !params.get('kat')) next.set('all', '1')
    const cat = params.get('cat') || params.get('kat')
    if (cat) next.set('cat', cat)
    setOpen(false)
    navigate(`/auctions${next.toString() ? `?${next}` : ''}`)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (hi?.kind === 'category' && categories[hi.index]) {
      pickCategory(categories[hi.index])
      return
    }
    if (hi?.kind === 'auction' && auctions[hi.index]) {
      pickAuction(auctions[hi.index])
      return
    }
    goSearch(q)
  }

  function pickCategory(c: SuggestCategory) {
    addRecentSearch(c.name)
    setOpen(false)
    setQ('')
    navigate(`/auctions?cat=${encodeURIComponent(c.id)}`)
  }

  function pickAuction(a: SuggestAuction) {
    setOpen(false)
    navigate(`/auction/${a.id}`)
  }

  const flatCount = categories.length + auctions.length
  const showPanel = open && q.trim().length >= 2 && (loading || flatCount > 0 || !loading)
  const showRecent = open && q.trim().length < 2 && recents.length > 0

  function moveHighlight(dir: 1 | -1) {
    if (!flatCount) return
    const items: Highlight[] = [
      ...categories.map((_, index) => ({ kind: 'category' as const, index })),
      ...auctions.map((_, index) => ({ kind: 'auction' as const, index })),
    ]
    if (!hi) {
      setHi(items[dir === 1 ? 0 : items.length - 1])
      return
    }
    const cur = items.findIndex((x) => x.kind === hi.kind && x.index === hi.index)
    const next = (cur + dir + items.length) % items.length
    setHi(items[next])
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      moveHighlight(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveHighlight(-1)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHi(null)
    }
  }

  return (
    <div className={`search-wrap ${className}`} ref={rootRef}>
      <form
        className={`search-bar search-bar--${mode} ${compact ? 'compact' : ''}`}
        onSubmit={onSubmit}
        role="search"
        autoComplete="off"
      >
        <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setRecents(getRecentSearches())
            setOpen(q.trim().length >= 2 || getRecentSearches().length > 0)
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Szukaj aukcji i kategorii"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel || showRecent}
        />
        {mode === 'hero' ? (
          <button type="submit" className="btn btn-primary search-submit">
            Szukaj
            <span aria-hidden>→</span>
          </button>
        ) : (
          <button type="submit" className="search-go" aria-label="Szukaj">
            →
          </button>
        )}
      </form>

      {showRecent ? (
        <div className="search-suggest" role="region" aria-label="Ostatnie wyszukiwania">
          <div className="search-suggest-section">
            <p className="search-suggest-label search-recent-head">
              Ostatnie wyszukiwania
              <button type="button" className="search-recent-clear" onClick={() => clearRecentSearches()}>
                Wyczyść
              </button>
            </p>
            <ul>
              {recents.map((t) => (
                <li key={t} className="search-recent-row">
                  <button type="button" className="search-recent-term" onClick={() => goSearch(t)}>
                    <span aria-hidden>🕘</span>
                    <span className="search-suggest-main">{t}</span>
                  </button>
                  <button
                    type="button"
                    className="search-recent-x"
                    aria-label={`Usuń „${t}” z historii`}
                    onClick={() => removeRecentSearch(t)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {forYou.length > 0 ? (
            <div className="search-suggest-section">
              <p className="search-suggest-label">Na podstawie Twojego wyszukiwania „{lastTerm}”</p>
              <ul>
                {forYou.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => pickAuction(a)}>
                      {a.image_url ? (
                        <img src={a.image_url} alt="" className="search-suggest-thumb" />
                      ) : (
                        <span className="search-suggest-thumb placeholder" aria-hidden />
                      )}
                      <span className="search-suggest-text">
                        <span className="search-suggest-main">{a.title}</span>
                        <span className="search-suggest-meta">
                          {formatPln(a.current_price)}
                          {a.city ? ` · ${a.city}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPanel ? (
        <div className="search-suggest" id={listId} role="listbox">
          {loading && flatCount === 0 ? <p className="search-suggest-empty">Szukam…</p> : null}

          {categories.length > 0 ? (
            <div className="search-suggest-section">
              <p className="search-suggest-label">Kategorie</p>
              <ul>
                {categories.map((c, index) => {
                  const active = hi?.kind === 'category' && hi.index === index
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={active ? 'is-active' : ''}
                        onMouseEnter={() => setHi({ kind: 'category', index })}
                        onClick={() => pickCategory(c)}
                      >
                        <span className="search-suggest-main">{c.name}</span>
                        {c.path && c.path !== c.name ? (
                          <span className="search-suggest-meta">{c.path}</span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {auctions.length > 0 ? (
            <div className="search-suggest-section">
              <p className="search-suggest-label">Aukcje</p>
              <ul>
                {auctions.map((a, index) => {
                  const active = hi?.kind === 'auction' && hi.index === index
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={active ? 'is-active' : ''}
                        onMouseEnter={() => setHi({ kind: 'auction', index })}
                        onClick={() => pickAuction(a)}
                      >
                        {a.image_url ? (
                          <img src={a.image_url} alt="" className="search-suggest-thumb" />
                        ) : (
                          <span className="search-suggest-thumb placeholder" aria-hidden />
                        )}
                        <span className="search-suggest-text">
                          <span className="search-suggest-main">{a.title}</span>
                          <span className="search-suggest-meta">
                            {formatPln(a.current_price)}
                            {a.city ? ` · ${a.city}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {!loading && flatCount === 0 ? (
            <p className="search-suggest-empty">
              Brak podpowiedzi — Enter szuka „{q.trim()}”
            </p>
          ) : null}

          <button type="button" className="search-suggest-all" onClick={() => goSearch(q)}>
            Szukaj „{q.trim()}” we wszystkich aukcjach →
          </button>
        </div>
      ) : null}
    </div>
  )
}
