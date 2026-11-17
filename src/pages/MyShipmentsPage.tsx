import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  PROGRESS_LABELS, SHIPPING_SOON, cancelShipment, downloadLabel, formatGrosz, listShipments, nextAction, progressStep,
  renewShipmentPayment, shippingError, useShippingStatus, type Shipment,
} from '../lib/shipping'
import './shipping.css'

function chipClass(s: Shipment) {
  return s.status === 'SHIPPING_FAILED' || s.status === 'CANCELLED' ? 'ship-chip bad' : s.status === 'DELIVERED' ? 'ship-chip ok' : 'ship-chip'
}

function ShipmentCard({ s, onChange }: { s: Shipment; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const step = progressStep(s.status)
  const seller = s.role === 'seller'

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onChange()
    } catch (e) {
      setError(shippingError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="ship-card">
      <div className="ship-top">
        <strong>Paczkomat {s.targetPoint}</strong>
        <span className={chipClass(s)}>{s.statusLabel}</span>
      </div>
      {s.targetPointName && <p className="muted">{s.targetPointName}</p>}
      {step >= 0 && (
        <ol className="ship-progress" aria-label="Postęp przesyłki">
          {PROGRESS_LABELS.map((l, i) => <li key={l} className={i <= step ? 'done' : ''}>{l}</li>)}
        </ol>
      )}
      <p>{nextAction(s)}</p>
      {s.trackingNumber && (
        <p>
          Numer przesyłki: <strong>{s.trackingNumber}</strong>{' '}
          {s.trackingUrl && <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer">Śledź w InPost</a>}
        </p>
      )}
      <p className="muted">Dostawa: {formatGrosz(s.priceGrosz)} · gabaryt {s.parcelSize}</p>
      {!seller && <p className="muted ship-note">{s.paymentNotice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="ship-actions">
        {seller && s.labelAvailable && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(async () => { await downloadLabel(s.id) })}>
            Pobierz etykietę (PDF)
          </button>
        )}
        {!seller && s.status === 'AWAITING_SHIPPING_PAYMENT' && (
          s.checkoutUrl
            ? <a className="btn btn-primary" href={s.checkoutUrl}>Zapłać za dostawę</a>
            : s.paymentMode === 'STANDALONE' && (
              <button type="button" className="btn btn-primary" disabled={busy}
                onClick={() => void run(async () => { const n = await renewShipmentPayment(s.id); if (n.checkoutUrl) window.location.href = n.checkoutUrl })}>
                Zapłać za dostawę
              </button>
            )
        )}
        {s.canCancel && (
          <button type="button" className="btn btn-outline" disabled={busy}
            onClick={() => { if (window.confirm('Anulować przesyłkę? Kupujący dostanie zwrot opłaty za dostawę.')) void run(() => cancelShipment(s.id)) }}>
            Anuluj przesyłkę
          </button>
        )}
        {s.auctionId && <Link className="btn btn-outline" to={`/auction/${s.auctionId}`}>Aukcja</Link>}
      </div>
      {s.history.length > 0 && (
        <details>
          <summary>Historia</summary>
          <ul className="ship-history">
            {s.history.map((h, i) => <li key={i}>{h.label} — {new Date(h.at).toLocaleString('pl-PL')}</li>)}
          </ul>
        </details>
      )}
    </article>
  )
}

/** "Moje przesyłki": what I bought (track, pay) and what I sell (label, number, status, locker). */
export function MyShipmentsPage() {
  const { user } = useAuth()
  const status = useShippingStatus(!!user)
  const [params, setParams] = useSearchParams()
  const role = params.get('role') === 'seller' ? 'seller' : 'buyer'
  const [loadedFor, setLoadedFor] = useState<{ role: string; items: Shipment[] } | null>(null)
  const items = loadedFor?.role === role ? loadedFor.items : null
  const [error, setError] = useState('')

  const load = useCallback(() => {
    listShipments(role)
      .then((list) => { setError(''); setLoadedFor({ role, items: list }) })
      .catch((e) => { setLoadedFor({ role, items: [] }); setError(shippingError(e)) })
  }, [role])

  useEffect(() => {
    if (!user) return
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [user, load])

  if (!user) return <div className="ship-page"><p><Link to="/login">Zaloguj się</Link>, żeby zobaczyć przesyłki.</p></div>
  // switched off: the page does not exist for anyone (also not via a saved link)
  if (status.loaded && !status.visible) return <Navigate to="/my" replace />
  if (!status.loaded) return <div className="ship-page"><p className="muted">Wczytywanie…</p></div>
  return (
    <div className="ship-page">
      <h1>Moje przesyłki</h1>
      {status.sandbox && <p className="ship-notice" role="note">Tryb testowy InPost: etykiety są próbne i nie służą do prawdziwych wysyłek.</p>}
      {!status.ready && <p className="ship-notice" role="note">{SHIPPING_SOON} Istniejące przesyłki możesz nadal śledzić; paczkę wyślij samodzielnie i wpisz jej numer w <Link to="/my/orders">zamówieniu</Link>.</p>}
      {params.get('paid') && <p className="success">Dziękujemy! Potwierdzamy płatność za dostawę, to potrwa chwilę.</p>}
      <div className="ship-tabs">
        <button type="button" className={`btn btn-sm ${role === 'buyer' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setParams({ role: 'buyer' })}>Kupuję</button>
        <button type="button" className={`btn btn-sm ${role === 'seller' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setParams({ role: 'seller' })}>Sprzedaję</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {items === null && <p className="muted">Wczytywanie…</p>}
      {items?.length === 0 && !error && <p className="muted">{role === 'seller' ? 'Nie masz jeszcze przesyłek do nadania.' : 'Nie masz jeszcze przesyłek. Dostawę wybierzesz na stronie wygranej aukcji.'}</p>}
      {items?.map((s) => <ShipmentCard key={s.id} s={s} onChange={load} />)}
    </div>
  )
}
