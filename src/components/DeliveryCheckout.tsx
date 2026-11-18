import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LockerPicker } from './LockerPicker'
import { COVERS, NOT_COVERS, PAYMENT_METHODS_NOTE, howItWorks, payClock } from '../lib/checkout'
import { costLines } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'
import { PAYU_TEST_NOTE } from '../lib/payuReturn'
import { normalisePhone, type LockerPoint, type ShippingConfig } from '../lib/shipping'
import '../pages/shipping.css'
import './checkout.css'
import './delivery-checkout.css'

export type CheckoutProduct = { image: string | null; title: string; seller: string | null; to?: string }
export type DeliveryChoice = { code: string; name: string | null; phone: string }

export function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg className="dc-shield" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5 4.5 5.5v5.7c0 4.6 3.1 8.6 7.5 10.3 4.4-1.7 7.5-5.7 7.5-10.3V5.5L12 2.5Z" fill="currentColor" opacity=".14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m8.8 12.2 2.3 2.3 4.3-4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * „Kup z dostawą”: dwie kolumny (produkt po lewej; po prawej 1 Dostawa, 2 Podsumowanie z Ochroną, 3 Zgoda i płatność), na telefonie jedna.
 * Wspólne dla strony zakupu „Kup teraz” (jeszcze bez zamówienia) i kasy istniejącego zamówienia. Jedna główna akcja: „Zapłać … przez PayU”.
 */
export function DeliveryCheckout({
  product, item, shipping, protection, total, cfg, payuReady, payuTest, recipient, defaultPhone, initialLockerCode, initialPhone,
  dueAt, dueConsequence, reportWindowHours, processing, busy, error, notice, resetTerms, onPay, onWriteToSeller, payHint,
}: {
  product: CheckoutProduct
  item: number
  shipping: number | null
  protection: number | null
  total: number | null
  cfg: ShippingConfig | null
  payuReady: boolean
  payuTest?: boolean
  recipient: string | null
  defaultPhone?: string | null
  initialLockerCode?: string | null
  initialPhone?: string | null
  /** termin płatności (kasa istniejącego zamówienia); null = jeszcze nie ma zamówienia */
  dueAt?: string | null
  dueConsequence?: string
  reportWindowHours?: number | null
  /** płatność w PayU już rozpoczęta: wystarczy do niej wrócić */
  processing?: boolean
  busy: boolean
  error?: string | null
  notice?: string | null
  /** zmiana tej wartości odznacza zgodę (np. zmieniła się kwota) */
  resetTerms?: number
  onPay: (d: DeliveryChoice) => void
  onWriteToSeller?: (() => void) | null
  payHint?: string
}) {
  const [point, setPoint] = useState<LockerPoint | null>(null)
  const [phone, setPhone] = useState('')
  const [terms, setTerms] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!dueAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [dueAt])
  useEffect(() => { if (defaultPhone && !phone) setPhone(defaultPhone.replace(/^\+48/, '')) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [defaultPhone])
  useEffect(() => { if (initialPhone && !phone) setPhone(initialPhone) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [initialLockerCode])
  useEffect(() => { setTerms(false) }, [resetTerms])

  const cost = costLines({ itemPrice: item, shippingPrice: shipping, protectionFee: protection, total })
  const code = point?.code ?? initialLockerCode ?? null
  const phoneOk = normalisePhone(phone)
  const clock = payClock(dueAt, now)
  const canPay = !!code && !!phoneOk && terms && payuReady && !busy
  const missing = !code || !phoneOk ? 'Wybierz Paczkomat i podaj telefon odbiorcy.' : !terms ? 'Zaznacz zgodę na regulamin Ochrony.' : ''

  function pay() {
    onPay({ code: code ?? '', name: point && point.name !== point.code ? point.name : null, phone: phoneOk ?? '' })
  }

  return (
    <div className="dc" data-testid="checkout">
      <aside className="dc-product" data-testid="checkout-product">
        {product.image ? <img src={product.image} alt="" /> : <div className="dc-noimg" aria-hidden="true" />}
        <div className="dc-product-info">
          <h2>{product.to ? <Link to={product.to}>{product.title}</Link> : product.title}</h2>
          {product.seller && <p className="muted">Sprzedawca: <strong>{product.seller}</strong></p>}
          <p className="dc-total-mini"><span>Razem do zapłaty</span><strong>{formatPln(cost.total)}</strong></p>
          {onWriteToSeller && <button type="button" className="bidsheet-link" onClick={onWriteToSeller}>Napisz do sprzedawcy</button>}
        </div>
      </aside>

      <div className="dc-main">
        {clock ? (
          <div className={`dc-clock ${clock.expired ? 'late' : ''}`} role="timer" data-testid="payment-deadline">
            <span className="dc-clock-time">{clock.text}</span>
            <span>{clock.expired ? 'Czas na płatność minął.' : 'tyle masz na płatność z Ochroną.'} {dueConsequence}</span>
          </div>
        ) : (
          <p className="dc-reserve">Przedmiot zarezerwujemy dla Ciebie na czas płatności. Jeśli nie zapłacisz w terminie, rezerwacja wygaśnie.</p>
        )}
        {processing && (
          <div className="pay-banner pay-pending" role="status">
            <strong>Masz rozpoczętą płatność w PayU</strong>
            <p>Jeśli ją przerwałeś, wróć do PayU i dokończ, albo poczekaj chwilę: pieniądze nie zostały pobrane, dopóki PayU nie potwierdzi wpłaty.</p>
          </div>
        )}
        {notice && <p className="success" role="status">{notice}</p>}

        <section className="dc-card" data-testid="step-delivery">
          <h3><span className="step-no">1</span>Dostawa</h3>
          <p>Przewoźnik: <strong>InPost Paczkomat 24/7</strong>. Wybierz Paczkomat, do którego sprzedawca wyśle paczkę.</p>
          <LockerPicker token={cfg?.geowidgetToken} environment={cfg?.environment ?? 'sandbox'} value={point} onChange={setPoint} initialCode={initialLockerCode} />
          <p>Odbiorca: <strong>{recipient ?? 'Ty'}</strong></p>
          <label className="dc-field">
            Telefon odbiorcy (9 cyfr, na ten numer InPost wyśle kod odbioru)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="600 100 200" />
          </label>
          {phone && !phoneOk && <p className="error">Podaj 9 cyfr, np. 600 100 200.</p>}
        </section>

        <section className="dc-card" data-testid="step-summary">
          <h3><span className="step-no">2</span>Podsumowanie</h3>
          <table className="checkout-table">
            <tbody>
              <tr><td>Cena przedmiotu</td><td>{formatPln(cost.lines[0].amount)}</td></tr>
              <tr><td>Dostawa Paczkomatem InPost</td><td>{formatPln(cost.lines[1].amount)}</td></tr>
              <tr><td><span className="dc-protect"><ShieldIcon size={18} />Ochrona Kupującego Bidigo</span></td><td>{formatPln(cost.lines[2].amount)}</td></tr>
              <tr className="total"><td>Razem</td><td>{formatPln(cost.total)}</td></tr>
            </tbody>
          </table>
          <details className="dc-details">
            <summary><ShieldIcon size={16} /> Co daje Ochrona Kupującego</summary>
            <p>Płacisz jednym przelewem przez PayU, a pieniądze za przedmiot czekają, dopóki nie potwierdzisz odbioru.</p>
            <h4>Obejmuje</h4>
            <ul>{COVERS.map((t) => <li key={t}>{t}</li>)}</ul>
            <h4>Nie obejmuje</h4>
            <ul>{NOT_COVERS.map((t) => <li key={t}>{t}</li>)}</ul>
            <ol className="checkout-how">{howItWorks(reportWindowHours ?? null).map((s) => <li key={s.title}><strong>{s.title}.</strong> {s.text}</li>)}</ol>
            <p><Link to="/ochrona-kupujacego" target="_blank">Pełne zasady Ochrony</Link></p>
          </details>
        </section>

        <section className="dc-card" data-testid="step-pay">
          <h3><span className="step-no">3</span>Zgoda i płatność</h3>
          <label className="checkout-terms" data-testid="step-terms">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} disabled={processing} />
            <span>Znam i akceptuję <Link to="/ochrona-kupujacego" target="_blank">regulamin Ochrony Kupującego</Link> oraz <Link to="/terms" target="_blank">Regulamin Bidigo</Link>.</span>
          </label>
          {payuTest && <p className="ship-notice" role="note">{PAYU_TEST_NOTE}</p>}
          {!payuReady && <p className="error" role="alert">Płatności PayU są chwilowo niedostępne. Spróbuj później albo napisz do sprzedawcy.</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="button" className="btn btn-primary btn-lg checkout-pay" disabled={processing ? busy : !canPay} onClick={pay}>
            {busy ? 'Przekierowanie do PayU…' : processing ? 'Wróć do płatności w PayU' : `Zapłać ${formatPln(cost.total)} przez PayU`}
          </button>
          {!processing && !canPay && !busy && missing && <p className="hint">{missing}</p>}
          <p className="hint">{payHint ?? PAYMENT_METHODS_NOTE} Pieniądze pobierze PayU; Bidigo nie przechowuje pieniędzy za przedmiot.</p>
        </section>
      </div>
    </div>
  )
}
