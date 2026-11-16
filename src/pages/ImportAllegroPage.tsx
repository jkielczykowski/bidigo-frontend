import { useCallback, useEffect, useState } from 'react'
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

const PAGE = 50

/** /sell/import: connect the seller's Allegro account, pick offers, then list them one by one in the usual form. */
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

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  const loadOffers = useCallback(async (offset: number) => {
    setBusy(true)
    setError(null)
    try {
      const page = await allegroOffers(offset, PAGE)
      setOffers((prev) => (offset === 0 ? page.offers : [...prev, ...page.offers]))
      setTotal(page.total)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Allegro revoked the access: connect again
        setStatus((s) => (s ? { ...s, connected: false } : s))
      } else {
        setError('Nie udało się pobrać ofert z Allegro. Spróbuj za chwilę.')
      }
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void (async () => {
      try {
        const s = await allegroStatus()
        setStatus(s)
        if (s.connected) await loadOffers(0)
      } catch {
        setError('Nie udało się sprawdzić połączenia z Allegro.')
      }
    })()
  }, [user, loadOffers])

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
    setBusy(true)
    try {
      await allegroDisconnect()
      setStatus((s) => (s ? { ...s, connected: false, login: undefined } : s))
      setOffers([])
      setPicked(new Set())
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

  return (
    <div className="container narrow page alg">
      <h1>Import z Allegro</h1>
      <p className="muted">
        Przenieś swoje oferty z Allegro na Bidigo. Pobieramy tytuł, opis, cenę i zdjęcia, a Ty sprawdzasz każdą
        aukcję przed wystawieniem — wybierasz kategorię, miasto i dostawę.
      </p>

      {result === 'connected' && <p className="alg-note is-ok">Połączono z Allegro. Wybierz oferty do zaimportowania.</p>}
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
            <button type="button" className="link-btn" disabled={busy} onClick={() => void disconnect()}>
              Odłącz
            </button>
          </div>

          {!busy && offers.length === 0 && <p className="muted">Nie znaleźliśmy aktywnych ofert na Twoim koncie Allegro.</p>}

          <ul className="alg-list">
            {offers.map((o) => (
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

          {offers.length < total && (
            <button type="button" className="btn" disabled={busy} onClick={() => void loadOffers(offers.length)}>
              {busy ? 'Ładowanie…' : `Pokaż więcej (${offers.length} z ${total})`}
            </button>
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
