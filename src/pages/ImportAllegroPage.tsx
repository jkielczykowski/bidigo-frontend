import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AllegroTabs } from '../components/AllegroTabs'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/bidigoApi'
import { allegroStatus, type AllegroOffer, type AllegroStatus } from '../lib/allegroApi'
import { fetchAllOffers } from '../lib/allegroOffersAll'
import { writeImportQueue } from '../lib/allegroQueue'
import type { LinkedListing } from '../lib/allegroSync'
import { myLinkedListings } from '../lib/allegroSyncApi'
import { formatPln } from '../lib/format'

/** Offers shown per page of the list */
const PER_VIEW = 20

type Filter = 'all' | 'new' | 'onBidigo'

/** /sell/import: all the seller's active Allegro offers (fetched with a progress bar), pick some to import. */
export function ImportAllegroPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [status, setStatus] = useState<AllegroStatus | null>(null)
  const [offers, setOffers] = useState<AllegroOffer[]>([])
  const [total, setTotal] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [linked, setLinked] = useState<LinkedListing[]>([])
  // a newer run (refresh, leaving the page) makes the older loop stop
  const runRef = useRef(0)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  // Allegro sends the browser back to /sell/import?allegro=…: that notice belongs on the connection screen
  useEffect(() => {
    const result = params.get('allegro')
    if (result) navigate(`/sell/import/connection?allegro=${encodeURIComponent(result)}`, { replace: true })
  }, [params, navigate])

  const loadAll = useCallback(async () => {
    const run = ++runRef.current
    setBusy(true)
    setError(null)
    setOffers([])
    setTotal(0)
    setView(0)
    try {
      await fetchAllOffers(
        (all, t) => {
          if (run !== runRef.current) return
          setOffers(all)
          setTotal(t)
        },
        () => run !== runRef.current,
      )
    } catch (e) {
      if (run !== runRef.current) return
      if (e instanceof ApiError && e.status === 409) {
        // Allegro revoked the access: connect again
        setStatus((st) => (st ? { ...st, connected: false } : st))
      } else {
        setError('Nie udało się pobrać wszystkich ofert z Allegro. Spróbuj odświeżyć listę.')
      }
    } finally {
      if (run === runRef.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    const runs = runRef
    return () => {
      runs.current += 1
    }
  }, [])

  useEffect(() => {
    if (!user || params.get('allegro')) return
    void (async () => {
      try {
        const s = await allegroStatus()
        setStatus(s)
        if (s.connected) {
          void myLinkedListings().then(setLinked).catch(() => setLinked([]))
          await loadAll()
        }
      } catch {
        setError('Nie udało się sprawdzić połączenia z Allegro.')
      }
    })()
  }, [user, loadAll, params])

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function refresh() {
    setPicked(new Set())
    void loadAll()
    void myLinkedListings().then(setLinked).catch(() => undefined)
  }

  // offers already on Bidigo (an active or draft listing) are not imported a second time
  const onBidigo = new Set(linked.filter((l) => l.status === 'active' || l.status === 'draft').map((l) => l.offerId))
  // the filtered list; "select all" and the import work on what is visible, never on offers already on Bidigo
  const visible = offers.filter((o) => (filter === 'all' ? true : filter === 'new' ? !onBidigo.has(o.id) : onBidigo.has(o.id)))
  const selectable = visible.filter((o) => !onBidigo.has(o.id))
  const newCount = offers.length - offers.filter((o) => onBidigo.has(o.id)).length
  const onCount = offers.length - newCount

  function toggleAll() {
    setPicked((prev) => {
      const allPicked = selectable.every((o) => prev.has(o.id))
      const next = new Set(prev)
      for (const o of selectable) {
        if (allPicked) next.delete(o.id)
        else next.add(o.id)
      }
      return next
    })
  }

  /** @param oneByOne the old way: a form per offer; otherwise one table for all of them */
  function start(oneByOne = false) {
    writeImportQueue({
      ids: offers.filter((o) => picked.has(o.id) && !onBidigo.has(o.id)).map((o) => o.id),
      pos: 0,
    })
    navigate(oneByOne ? '/sell?import=1' : '/sell/import/review')
  }

  if (loading || !user) {
    return (
      <div className="container narrow page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  const pages = Math.max(1, Math.ceil(visible.length / PER_VIEW))
  const current = Math.min(view, pages - 1)
  const shown = visible.slice(current * PER_VIEW, (current + 1) * PER_VIEW)
  const pct = total > 0 ? Math.round((offers.length / total) * 100) : 0

  return (
    <div className="container page alg alg-wide">
      <h1>Import z Allegro</h1>
      <AllegroTabs />
      <p className="muted">
        Wybierz oferty z Allegro, które chcesz przenieść na Bidigo. Pobieramy tytuł, opis, cenę i zdjęcia, a Ty ustawiasz miasto,
        dostawę i sprawdzasz kategorie w jednej tabeli.
      </p>

      {error && <p className="alg-note is-err">{error}</p>}

      {status && !status.configured && (
        <div className="card-form">
          <h2>Import będzie dostępny wkrótce</h2>
          <p className="muted">Pracujemy nad połączeniem z Allegro. Do tego czasu możesz wystawić aukcję ręcznie.</p>
          <Link className="btn btn-primary" to="/sell">
            Wystaw aukcję
          </Link>
        </div>
      )}

      {status?.configured && !status.connected && (
        <div className="card-form alg-connect">
          <h2>Najpierw połącz konto Allegro</h2>
          <p className="muted">Żeby zobaczyć swoje oferty, połącz konto na osobnym ekranie. To zajmuje chwilę.</p>
          <Link className="btn btn-primary" to="/sell/import/connection">
            Przejdź do połączenia
          </Link>
        </div>
      )}

      {status?.connected && (
        <>
          <div className="alg-bar">
            <span>
              {busy ? 'Pobieramy oferty…' : `${total} ${total === 1 ? 'oferta' : 'ofert'} na Allegro`}
              {status.login ? (
                <>
                  {' · '}
                  <b>{status.login}</b>
                </>
              ) : null}
            </span>
            <span className="alg-bar-actions">
              <button type="button" className="link-btn" disabled={busy} onClick={refresh}>
                Odśwież listę
              </button>
              <Link className="link-btn" to="/sell/import/connection">
                Połączenie
              </Link>
            </span>
          </div>

          {busy && (
            <div className="alg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="alg-progress-track">
                <div className="alg-progress-fill" style={{ width: `${Math.max(pct, 4)}%` }} />
              </div>
              <span>{total > 0 ? `Pobieramy oferty z Allegro… ${offers.length} z ${total}` : 'Pobieramy oferty z Allegro…'}</span>
            </div>
          )}

          {!busy && offers.length > 0 && (
            <div className="alg-filters" role="group" aria-label="Filtr ofert">
              {(
                [
                  ['all', `Wszystkie (${offers.length})`],
                  ['new', `Jeszcze nie na Bidigo (${newCount})`],
                  ['onBidigo', `Już na Bidigo (${onCount})`],
                ] as [Filter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`alg-chip${filter === id ? ' is-active' : ''}`}
                  aria-pressed={filter === id}
                  onClick={() => {
                    setFilter(id)
                    setView(0)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {selectable.length > 1 && !busy && (
            <button type="button" className="link-btn" onClick={toggleAll}>
              {selectable.every((o) => picked.has(o.id)) ? 'Odznacz wszystkie' : `Zaznacz wszystkie (${selectable.length})`}
            </button>
          )}

          {!busy && offers.length === 0 && <p className="muted">Nie znaleźliśmy aktywnych ofert na Twoim koncie Allegro.</p>}
          {!busy && offers.length > 0 && visible.length === 0 && (
            <p className="muted">{filter === 'onBidigo' ? 'Żadna z ofert nie jest jeszcze na Bidigo.' : 'Wszystkie oferty są już na Bidigo.'}</p>
          )}

          <ul className="alg-list">
            {shown.map((o) => (
              <li key={o.id}>
                <label className={`alg-item${picked.has(o.id) ? ' is-picked' : ''}${onBidigo.has(o.id) ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={picked.has(o.id)}
                    disabled={onBidigo.has(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                  {o.imageUrl ? <img src={o.imageUrl} alt="" loading="lazy" /> : <span className="alg-noimg" />}
                  <span className="alg-title">
                    {o.title}
                    {onBidigo.has(o.id) && <em className="alg-badge">Już na Bidigo</em>}
                  </span>
                  <b>{o.price != null ? formatPln(o.price) : ''}</b>
                </label>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav className="alg-pager" aria-label="Strony ofert">
              <button type="button" className="btn" disabled={current === 0} onClick={() => setView(current - 1)}>
                ← Poprzednia
              </button>
              <span>
                Strona {current + 1} z {pages}
              </span>
              <button type="button" className="btn" disabled={current >= pages - 1} onClick={() => setView(current + 1)}>
                Następna →
              </button>
            </nav>
          )}

          <div className="alg-cta">
            <button type="button" className="btn btn-primary" disabled={picked.size === 0} onClick={() => start()}>
              {picked.size === 0 ? 'Wybierz oferty' : `Dalej: importuj wybrane (${picked.size})`}
            </button>
            {picked.size > 0 && (
              <button type="button" className="link-btn" onClick={() => start(true)}>
                Wypełnij każdą aukcję osobno
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
