import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AllegroTabs } from '../components/AllegroTabs'
import { useAuth } from '../lib/auth'
import { allegroConnectUrl, allegroDisconnect, allegroSetEndOnSale, allegroStatus, type AllegroStatus } from '../lib/allegroApi'

/** /sell/import/connection: connect or disconnect the seller's Allegro account. */
export function AllegroConnectionPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<AllegroStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const result = params.get('allegro')

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    allegroStatus()
      .then(setStatus)
      .catch(() => setError('Nie udało się sprawdzić połączenia z Allegro.'))
  }, [user])

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

  async function toggleEndOnSale(on: boolean) {
    setBusy(true)
    setError(null)
    try {
      setStatus(await allegroSetEndOnSale(on))
    } catch {
      setError(on ? 'Nie udało się włączyć opcji. Połącz konto z Allegro ponownie, żeby przyznać uprawnienie.' : 'Nie udało się zmienić ustawienia.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    setError(null)
    try {
      await allegroDisconnect()
      setStatus((s) => (s ? { ...s, connected: false, login: undefined } : s))
      // the ?allegro=connected notice of this visit no longer applies
      setParams({}, { replace: true })
    } catch {
      setError('Nie udało się odłączyć konta. Spróbuj ponownie.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="container narrow page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  return (
    <div className="container page alg alg-wide">
      <h1>Import z Allegro</h1>
      <AllegroTabs />

      {result === 'connected' && status?.connected && <p className="alg-note is-ok">Połączono z Allegro. Możesz teraz wybrać oferty do importu.</p>}
      {result === 'error' && <p className="alg-note is-err">Nie udało się połączyć z Allegro. Spróbuj jeszcze raz.</p>}
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
        <div className="card-form alg-connect">
          <h2>Konto Allegro połączone</h2>
          <p>
            {status.login ? (
              <>
                Połączono jako <b>{status.login}</b>.
              </>
            ) : (
              'Połączono.'
            )}
          </p>
          <ul className="alg-points">
            <li>Domyślnie mamy dostęp tylko do odczytu Twoich aktywnych ofert.</li>
            <li>Niczego nie zmieniamy na Allegro, chyba że sam włączysz opcję kończenia ofert po sprzedaży (poniżej).</li>
            <li>Nie widzimy Twojego hasła.</li>
            <li>Po odłączeniu usuwamy zapisany dostęp. Już zaimportowane aukcje zostają na Bidigo.</li>
          </ul>
          <section className="alg-endsale">
            <h3>Kończenie ofert na Allegro po sprzedaży</h3>
            <p className="muted">
              Gdy aukcja zaimportowana z Allegro sprzeda się na Bidigo, zakończymy też jej ofertę na Allegro, żeby nikt nie kupił
              tego samego przedmiotu drugi raz. Dotyczy tylko sprzedaży po włączeniu opcji, sprawdzamy co kilka minut.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!status.endOnSale}
                disabled={busy || (!status.canEndOffers && !status.endOnSale)}
                onChange={(e) => void toggleEndOnSale(e.target.checked)}
              />
              Kończ oferty na Allegro po sprzedaży na Bidigo
            </label>
            {!status.canEndOffers && (
              <p className="alg-warn">
                Allegro nie przyznało jeszcze uprawnienia do kończenia ofert. Połącz konto ponownie i zaakceptuj je na ekranie
                Allegro.
                <button type="button" className="link-btn" disabled={busy} onClick={() => void connect()}>
                  Połącz ponownie
                </button>
              </p>
            )}
          </section>
          <div className="alg-actions">
            <Link className="btn btn-primary" to="/sell/import">
              Wybierz oferty do importu
            </Link>
            <Link className="btn" to="/sell/import/imported">
              Zaimportowane
            </Link>
            <button type="button" className="link-btn" disabled={busy} onClick={() => void disconnect()}>
              Odłącz konto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
