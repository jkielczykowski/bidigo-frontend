import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/bidigoApi'
import {
  allegroConnectUrl,
  allegroDisconnect,
  allegroOffers,
  allegroStatus,
  type AllegroOffer,
  type AllegroStatus,
} from '../lib/allegroApi'
import { writeImportQueue } from '../lib/allegroQueue'
import { formatPln } from '../lib/format'

/** Offers fetched per request (the API allows 100) */
const PAGE = 50
/** Offers shown per page of the list */
const PER_VIEW = 20
/** Safety cap on one load-everything run */
const MAX_OFFERS = 2000

/** /sell/import: connect the seller's Allegro account, pick offers, then list them one by one in the usual form. */
export function ImportAllegroPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<AllegroStatus | null>(null)
  const [offers, setOffers] = useState<AllegroOffer[]>([])
  const [total, setTotal] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState(0)
  // a newer run (refresh, disconnect, leaving the page) makes the older loop stop
  const runRef = useRef(0)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  /** Fetches every page of offers one after another, showing them (and the progress) as they arrive. */
  const loadAll = useCallback(async () => {
    const run = ++runRef.current
    setBusy(true)
    setError(null)
    setOffers([])
    setTotal(0)
    setView(0)
    try {
      let offset = 0
      for (;;) {
        const page = await allegroOffers(offset, PAGE)
        if (run !== runRef.current) return
        setOffers((prev) => (offset === 0 ? page.offers : [...prev, ...page.offers]))
        setTotal(page.total)
        offset += page.offers.length
        if (page.offers.length === 0 || offset >= page.total || offset >= MAX_OFFERS) break
      }
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
    if (!user) return
    void (async () => {
      try {
        const s = await allegroStatus()
        setStatus(s)
        if (s.connected) await loadAll()
      } catch {
        setError('Nie udało się sprawdzić połączenia z Allegro.')
      }
    })()
  }, [user, loadAll])

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      window.location.assign(await allegroConnectUrl())
    } catch {
      setError('Nie udało się połączyć z Allegro.')
      setBusy(false)
    }
  }

  async function disconnect() {
    runRef.current += 1
    setBusy(true)
    try {
      await allegroDisconnect()
      setStatus((s) => (s ? { ...s, connected: false, login: undefined } : s))
      setOffers([])
      setTotal(0)
      setPicked(new Set())
      // the ?allegro=connected notice of this visit no longer applies
      setParams({}, { replace: true })
    } finally {
      setBusy(false)
    }
  }

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
  }

  function toggleAll() {
    setPicked((prev) => (prev.size === offers.length ? new Set() : new Set(offers.map((o) => o.id))))
  }

  function start() {
    writeImportQueue({ ids: offers.filter((o) => picked.has(o.id)).map((o) => o.id), pos: 0 })
    navigate('/sell?import=1')
  }

  if (loading || !user) {
    return (
      <div className="container narrow page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  const result = params.get('allegro')
  const pages = Math.max(1, Math.ceil(offers.length / PER_VIEW))
  const current = Math.min(view, pages - 1)
  const shown = offers.slice(current * PER_VIEW, (current + 1) * PER_VIEW)
  const pct = total > 0 ? Math.round((offers.length / total) * 100) : 0

  return (
    <div className="container narrow page alg">
      <h1>Import z Allegro</h1>
      <p className="muted">
        Przenieś swoje oferty z Allegro na Bidigo. Pobieramy tytuł, opis, cenę i zdjęcia, a Ty sprawdzasz każdą
        aukcję przed wystawieniem — wybierasz kategorię, miasto i dostawę.
      </p>

      {result === 'connected' && status?.connected && <p className="alg-note is-ok">Połączono z Allegro. Wybierz oferty do zaimportowania.</p>}
      {result === 'error' && (
        <p className="alg-note is-err">Nie udało się połączyć z Allegro. Spróbuj jeszcze raz.</p>
      )}
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
          <h2>Połącz konto Allegro</h2>
          <ul className="alg-points">
            <li>Przekierujemy Cię do Allegro, gdzie zgadzasz się na odczyt swoich ofert.</li>
            <li>Nie widzimy Twojego hasła i niczego nie zmieniamy na Allegro.</li>
            <li>Połączenie możesz w każdej chwili odłączyć.</li>
          </ul>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void connect()}>
            {busy ? 'Łączenie…' : 'Połącz z Allegro'}
          </button>
        </div>
      )}

      {status?.connected && (
        <>
          <div className="alg-bar">
            <span>
              Połączono{status.login ? <> jako <b>{status.login}</b></> : null}
            </span>
            <span className="alg-bar-actions">
              <button type="button" className="link-btn" disabled={busy} onClick={refresh}>
                Odśwież listę
              </button>
              <button type="button" className="link-btn" disabled={busy} onClick={() => void disconnect()}>
                Odłącz
              </button>
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

          {offers.length > 1 && !busy && (
            <button type="button" className="link-btn" onClick={toggleAll}>
              {picked.size === offers.length ? 'Odznacz wszystkie' : `Zaznacz wszystkie (${offers.length})`}
            </button>
          )}

          {!busy && offers.length === 0 && <p className="muted">Nie znaleźliśmy aktywnych ofert na Twoim koncie Allegro.</p>}

          <ul className="alg-list">
            {shown.map((o) => (
              <li key={o.id}>
                <label className={`alg-item${picked.has(o.id) ? ' is-picked' : ''}`}>
                  <input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
                  {o.imageUrl ? <img src={o.imageUrl} alt="" loading="lazy" /> : <span className="alg-noimg" />}
                  <span className="alg-title">{o.title}</span>
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
            <button type="button" className="btn btn-primary" disabled={picked.size === 0} onClick={start}>
              {picked.size === 0 ? 'Wybierz oferty' : `Importuj wybrane (${picked.size})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
