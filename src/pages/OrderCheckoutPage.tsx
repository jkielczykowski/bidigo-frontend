import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LockerPicker } from '../components/LockerPicker'
import { useAuth } from '../lib/auth'
import { acceptOrderTerms, fetchCheckoutState, fetchOrder, fetchPayuStatus, setOrderDelivery, startOrderCheckout, type CheckoutState, type PayuStatus } from '../lib/ordersApi'
import { COVERS, NOT_COVERS, PAYMENT_METHODS_NOTE, howItWorks, paymentDeadline } from '../lib/checkout'
import { PAYU_TEST_NOTE } from '../lib/payuReturn'
import { costLines, type Order } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { normalisePhone, shippingConfig, type LockerPoint, type ShippingConfig } from '../lib/shipping'
import '../components/checkout.css'
import './shipping.css'

/**
 * „Podsumowanie zamówienia” przed płatnością: (1) dostawa, (2) koszty w tabeli, (3) jak to działa, (4) zgoda na regulamin Ochrony,
 * (5) zapłata przez PayU. Kwoty i kwalifikacja są z backendu; nic nie jest zaznaczone domyślnie. Płatność ruszy dopiero po wyborze
 * Paczkomatu i zgodzie (baza tego pilnuje, nie tylko ta strona).
 */
export function OrderCheckoutPage() {
  const { id = '' } = useParams()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [state, setState] = useState<CheckoutState | null>(null)
  const [cfg, setCfg] = useState<ShippingConfig | null>(null)
  const [payu, setPayu] = useState<PayuStatus | null>(null)
  const [point, setPoint] = useState<LockerPoint | null>(null)
  const [phone, setPhone] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !id) return
    void fetchOrder(id).then(setOrder).catch((e) => setError(errorMessage(e, 'Nie znaleziono zamówienia')))
    void fetchCheckoutState(id).then(setState).catch(() => {})
    void shippingConfig().then(setCfg).catch(() => {})
    void fetchPayuStatus().then(setPayu).catch(() => {})
  }, [user, id])

  useEffect(() => {
    if (profile?.phone && !phone) setPhone(profile.phone.replace(/^\+48/, ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.phone])

  useEffect(() => {
    if (state?.delivery?.phone && !phone) setPhone(state.delivery.phone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.delivery?.lockerCode])

  if (!user) return <div className="checkout-page"><p><Link to="/login">Zaloguj się</Link>, żeby zapłacić za zamówienie.</p></div>
  if (!order) return <div className="checkout-page">{error ? <p className="error">{error}</p> : <p className="muted">Ładowanie…</p>}</div>
  if (order.role !== 'buyer' || order.fulfillment !== 'protected' || !['AWAITING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.status)) {
    nav(`/my/orders/${order.id}`, { replace: true })
    return null
  }

  const code = point?.code ?? null
  const phoneOk = normalisePhone(phone)
  const cost = costLines({ itemPrice: order.itemAmount, shippingPrice: order.shippingAmount, protectionFee: order.protectionFee, total: order.totalAmount })
  const payuReady = !!payu?.ready && payu.marketplaceEnabled !== false
  const canPay = !!code && !!phoneOk && terms && payuReady && !busy
  const processing = order.status === 'PAYMENT_PROCESSING'

  async function pay() {
    if (!order || !state) return
    setBusy(true)
    setError(null)
    try {
      if (!processing) {
        await setOrderDelivery(order.id, code ?? '', (point && point.name !== point.code ? point.name : state.delivery?.lockerName ?? point?.name) ?? null, phoneOk ?? '')
        await acceptOrderTerms(order.id, state.termsVersion)
      }
      const r = await startOrderCheckout(order.id, order.totalAmount)
      if (r.status === 'total_changed') {
        setNotice(`Koszt zamówienia się zmienił. Nowa kwota do zapłaty: ${formatPln(r.total)}. Sprawdź podsumowanie i zapłać jeszcze raz.`)
        setTerms(false)
        setOrder(await fetchOrder(order.id))
      } else {
        window.location.assign(r.checkoutUrl)
        return
      }
    } catch (e) {
      setError(errorMessage(e, 'Nie udało się rozpocząć płatności'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="checkout-page" data-testid="checkout">
      <p><Link to={`/my/orders/${order.id}`}>← Zamówienie {order.number}</Link></p>
      <h1>Podsumowanie zamówienia</h1>
      <p className="muted">{order.itemTitle}</p>
      {(() => {
        const d = paymentDeadline(order, Date.now())
        return d && <div className="pay-banner" role="status" data-testid="payment-deadline"><strong>{d.title}</strong><p>{d.consequence}</p></div>
      })()}
      {processing && (
        <div className="pay-banner pay-pending" role="status">
          <strong>Masz rozpoczętą płatność w PayU</strong>
          <p>Jeśli ją przerwałeś, wróć do PayU i dokończ, albo poczekaj chwilę: pieniądze nie zostały pobrane, dopóki PayU nie potwierdzi wpłaty.</p>
        </div>
      )}
      {notice && <p className="success" role="status">{notice}</p>}

      <section className="checkout-card" data-testid="step-delivery">
        <h2><span className="step-no">1</span>Dostawa</h2>
        <p>Przewoźnik: <strong>InPost Paczkomat 24/7</strong>. Wybierz Paczkomat, do którego sprzedający wyśle paczkę.</p>
        <LockerPicker token={cfg?.geowidgetToken} environment={cfg?.environment ?? 'sandbox'} value={point} onChange={setPoint} initialCode={state?.delivery?.lockerCode} />
        <p>Odbiorca: <strong>{order.buyerName ?? 'Ty'}</strong></p>
        <label>
          Telefon odbiorcy (9 cyfr, na ten numer InPost wyśle kod odbioru)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="600 100 200" />
        </label>
        {phone && !phoneOk && <p className="error">Podaj 9 cyfr, np. 600 100 200.</p>}
      </section>

      <section className="checkout-card" data-testid="step-summary">
        <h2><span className="step-no">2</span>Podsumowanie kosztów</h2>
        <table className="checkout-table">
          <tbody>
            <tr><td>Cena przedmiotu</td><td>{formatPln(cost.lines[0].amount)}</td></tr>
            <tr><td>Dostawa Paczkomatem InPost</td><td>{formatPln(cost.lines[1].amount)}</td></tr>
            <tr><td>Opłata za Ochronę Kupującego Bidigo</td><td>{formatPln(cost.lines[2].amount)}</td></tr>
            <tr className="total"><td>Razem do zapłaty</td><td>{formatPln(cost.total)}</td></tr>
          </tbody>
        </table>
        <details>
          <summary>Co obejmuje Ochrona i czego nie</summary>
          <h3>Obejmuje</h3>
          <ul>{COVERS.map((t) => <li key={t}>{t}</li>)}</ul>
          <h3>Nie obejmuje</h3>
          <ul>{NOT_COVERS.map((t) => <li key={t}>{t}</li>)}</ul>
          <p><Link to="/ochrona-kupujacego" target="_blank">Pełne zasady Ochrony</Link></p>
        </details>
        <p className="hint">Opłata za Ochronę i dostawa to opłaty Bidigo. Pieniądze za przedmiot trafiają do sprzedającego dopiero po Twoim potwierdzeniu odbioru. Możesz też <Link to={`/my/orders/${order.id}`}>kupić bezpośrednio od sprzedającego</Link>, bez Ochrony.</p>
      </section>

      <section className="checkout-card" data-testid="step-how">
        <h2><span className="step-no">3</span>Jak to działa</h2>
        <ol className="checkout-how">
          {howItWorks(state?.reportWindowHours ?? null).map((s) => <li key={s.title}><strong>{s.title}.</strong> {s.text}</li>)}
        </ol>
      </section>

      <section className="checkout-card" data-testid="step-terms">
        <h2><span className="step-no">4</span>Zgoda</h2>
        <label className="checkout-terms">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} disabled={processing} />
          <span>Znam i akceptuję <Link to="/ochrona-kupujacego" target="_blank">regulamin Ochrony Kupującego</Link> oraz <Link to="/terms" target="_blank">Regulamin Bidigo</Link>.</span>
        </label>
      </section>

      <section className="checkout-card" data-testid="step-pay">
        <h2><span className="step-no">5</span>Płatność</h2>
        {payu?.testMode && <p className="ship-notice" role="note">{PAYU_TEST_NOTE}</p>}
        {payu && !payuReady && <p className="error" role="alert">Płatności PayU są chwilowo niedostępne. Spróbuj później albo kup bezpośrednio od sprzedającego.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary btn-lg checkout-pay" disabled={processing ? busy : !canPay} onClick={() => void pay()}>
          {busy ? 'Przekierowanie do PayU…' : processing ? 'Wróć do płatności w PayU' : `Zapłać ${formatPln(cost.total)} przez PayU`}
        </button>
        {!processing && !canPay && !busy && (
          <p className="hint">{!code || !phoneOk ? 'Wybierz Paczkomat i podaj telefon odbiorcy.' : !terms ? 'Zaznacz zgodę na regulamin Ochrony.' : ''}</p>
        )}
        <p className="hint">{PAYMENT_METHODS_NOTE} Pieniądze pobierze PayU; Bidigo nie przechowuje pieniędzy za przedmiot.</p>
      </section>
    </div>
  )
}
