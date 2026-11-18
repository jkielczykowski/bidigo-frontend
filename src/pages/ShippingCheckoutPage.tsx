import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LockerPicker } from '../components/LockerPicker'
import { fetchAuctionLockerAllowed } from '../lib/ordersApi'
import { LOCKER_EXCLUDED_TEXT } from '../lib/ordersLogic'
import { useAuth } from '../lib/auth'
import {
  SHIPPING_SOON, useShippingStatus, formatGrosz, normalisePhone, openShipment, shippingConfig, shippingError, shipmentByOrder,
  type LockerPoint, type ParcelSize, type ShippingConfig,
} from '../lib/shipping'
import './shipping.css'

/**
 * Delivery for a won auction: pick a parcel locker, see the price BEFORE paying, pay for the delivery.
 * ?protection=1 (set by the order flow) = the delivery is part of an order with Buyer Protection and is paid with it.
 */
export function ShippingCheckoutPage() {
  const { orderId = '' } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const status = useShippingStatus(!!user)
  const [params] = useSearchParams()
  const protection = params.get('protection') === '1'
  const [cfg, setCfg] = useState<ShippingConfig | null>(null)
  const [size, setSize] = useState<ParcelSize>('A')
  const [point, setPoint] = useState<LockerPoint | null>(null)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lockerOk, setLockerOk] = useState<boolean | null>(null)

  useEffect(() => {
    void fetchAuctionLockerAllowed(orderId).then(setLockerOk).catch(() => setLockerOk(false))
    void shippingConfig().then(setCfg).catch(() => setError('Nie udało się wczytać cennika dostawy.'))
    // already opened (page reloaded or the buyer came back from the payment)?
    void shipmentByOrder(orderId).then(() => nav('/my/shipments', { replace: true })).catch(() => {})
  }, [orderId, nav])

  if (!user) return <div className="ship-page"><p>Zaloguj się, żeby wybrać dostawę. <Link to="/login">Zaloguj się</Link></p></div>
  if (status.loaded && !status.visible) return <Navigate to="/my" replace />
  if (!status.loaded || lockerOk === null) return <div className="ship-page"><p className="muted">Wczytywanie…</p></div>
  if (!lockerOk) {
    // direct link to the checkout of an item whose category cannot go by parcel locker
    return (
      <div className="ship-page">
        <h1>Dostawa</h1>
        <div className="ship-notice" role="status">
          <strong>{LOCKER_EXCLUDED_TEXT}</strong>
          <p>Umów się ze sprzedającym na odbiór osobisty lub transport w czacie.</p>
        </div>
        <div className="ship-actions">
          <Link className="btn btn-primary" to="/my/orders">Zamówienia</Link>
          <Link className="btn btn-outline" to="/messages">Wiadomości</Link>
        </div>
      </div>
    )
  }
  // The backend says a delivery cannot be paid for now (no InPost credentials, no payment gateway, sandbox with real money):
  // no form, no payment button, and nothing is ever charged.
  if (!status.ready && !protection) {
    return (
      <div className="ship-page">
        <h1>Dostawa do Paczkomatu InPost</h1>
        <div className="ship-notice" role="status">
          <strong>{SHIPPING_SOON}</strong>
          <p>Napisz do sprzedającego i umówcie się na wysyłkę lub odbiór. Sprzedający może wysłać paczkę sam i wpisać numer przesyłki w zamówieniu.</p>
        </div>
        <div className="ship-actions">
          <Link className="btn btn-primary" to="/my/orders">Moje zamówienia</Link>
          <Link className="btn btn-outline" to="/messages">Wiadomości</Link>
        </div>
      </div>
    )
  }
  const price = cfg?.sizes.find((s) => s.size === size)?.priceGrosz ?? 0
  const code = point?.code ?? null
  const phoneOk = normalisePhone(phone)
  const canPay = !!cfg?.enabled && !!code && !!phoneOk && !busy

  async function submit() {
    if (!code || !phoneOk) return
    setBusy(true)
    setError('')
    try {
      const s = await openShipment({ orderId, lockerCode: code, lockerName: point?.name, phone: phoneOk, size, protection })
      if (s.checkoutUrl) window.location.href = s.checkoutUrl
      else nav('/my/shipments')
    } catch (e) {
      setError(shippingError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ship-page">
      <h1>Dostawa do Paczkomatu InPost</h1>
      {status.sandbox && <p className="ship-notice" role="note">Tryb testowy: etykieta InPost jest próbna, a płatność testowa. Nie wysyłaj prawdziwej paczki.</p>}
      {cfg && !cfg.enabled && <p className="notice">Wysyłka InPost nie jest jeszcze włączona. Dogadaj dostawę ze sprzedającym.</p>}
      <div className="ship-notice" role="note">
        {protection ? cfg?.protectionNotice : cfg?.standaloneNotice}
        {!protection && ' Cenę przedmiotu płacisz sprzedającemu osobno.'}
      </div>

      <div className="ship-card">
        <h2>1. Rozmiar paczki</h2>
        <div className="ship-sizes">
          {cfg?.sizes.map((s) => (
            <label key={s.size} className={`ship-size${s.size === size ? ' on' : ''}`}>
              <input type="radio" name="size" checked={s.size === size} onChange={() => setSize(s.size)} />
              <strong>Gabaryt {s.size}</strong> · {formatGrosz(s.priceGrosz)}
              <br /><small>do {s.dimensions}</small>
            </label>
          ))}
        </div>

        <h2>2. Paczkomat odbioru</h2>
        <LockerPicker token={cfg?.geowidgetToken} environment={cfg?.environment ?? 'sandbox'} value={point} onChange={setPoint} />

        <h2>3. Telefon do powiadomień InPost</h2>
        <label>
          Numer komórkowy (9 cyfr)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="600 100 200" />
        </label>
        {phone && !phoneOk && <p className="error">Podaj 9 cyfr, np. 600 100 200.</p>}

        <div className="ship-total"><span>Koszt dostawy</span><span>{formatGrosz(price)}</span></div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary" disabled={!canPay} onClick={() => void submit()}>
          {busy ? 'Przekierowanie…' : protection ? 'Dalej' : `Zapłać ${formatGrosz(price)} za dostawę`}
        </button>
        {!protection && <p className="hint">Płacisz tylko za przesyłkę. To nie jest Ochrona Kupującego.</p>}
      </div>
    </div>
  )
}
