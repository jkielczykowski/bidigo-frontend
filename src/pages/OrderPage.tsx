import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  cancelOrder, chooseDirect, confirmReceipt, fetchOrder, markShipped, reportProblem, respondDispute, startOrderCheckout,
} from '../lib/ordersApi'
import { PROBLEM_KINDS, costLines, statusLabel, statusTone, visibleActions, type Order, type OrderAction } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { PAYU_NOTE, PAYU_TEST_NOTE, orderPayState, returnedFromPayu } from '../lib/payuReturn'
import { fetchPayuStatus, type PayuStatus } from '../lib/ordersApi'
import { PaymentStateBanner } from '../components/PaymentStateBanner'
import './shipping.css'

const DISPUTE_STATUS: Record<string, string> = {
  open: 'Rozpatrujemy zgłoszenie',
  resolved_buyer: 'Rozstrzygnięte na korzyść kupującego',
  resolved_seller: 'Rozstrzygnięte na korzyść sprzedającego',
  resolved_partial: 'Rozstrzygnięte — zwrot częściowy',
  closed: 'Zamknięte',
}

export function OrderPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<'problem' | 'cancel' | 'ship' | 'respond' | null>(null)
  const [text, setText] = useState('')
  const [kind, setKind] = useState('not_as_described')
  const [expected, setExpected] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const o = await fetchOrder(id)
      setOrder(o)
      setExpected((prev) => prev ?? o.totalAmount)
      setError(null)
    } catch (e) {
      setError(errorMessage(e, 'Nie znaleziono zamówienia'))
    }
  }, [id])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  const [payu, setPayu] = useState<PayuStatus | null>(null)
  useEffect(() => {
    void fetchPayuStatus().then(setPayu).catch(() => setPayu(null))
  }, [])

  // return from PayU (?payment=payu): the signed notification may need a moment, so the order is re-read until it settles
  const returned = returnedFromPayu(params)
  useEffect(() => {
    if (!returned || !user) return
    const t = setInterval(() => void load(), 3000)
    const stop = setTimeout(() => clearInterval(t), 120000)
    return () => {
      clearInterval(t)
      clearTimeout(stop)
    }
  }, [returned, user, load])

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setPanel(null)
      setText('')
      if (done) setNotice(done)
      await load()
    } catch (e) {
      setError(errorMessage(e, 'Nie udało się wykonać operacji'))
    } finally {
      setBusy(false)
    }
  }

  async function pay() {
    if (!order || expected == null) return
    setBusy(true)
    setError(null)
    try {
      const r = await startOrderCheckout(order.id, expected)
      if (r.status === 'total_changed') {
        setExpected(r.total)
        setNotice(`Koszt zamówienia się zmienił. Nowa kwota do zapłaty: ${formatPln(r.total)}. Sprawdź i potwierdź jeszcze raz.`)
        await load()
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

  if (!user) {
    return (
      <div className="container page">
        <p>
          <Link to="/login">Zaloguj się</Link>, żeby zobaczyć zamówienie.
        </p>
      </div>
    )
  }
  if (!order) return <div className="container page">{error ? <p className="error">{error}</p> : <p className="muted">Ładowanie…</p>}</div>

  const actions = visibleActions(order)
  const has = (a: OrderAction) => actions.includes(a)
  const isBuyer = order.role === 'buyer'
  const summary = costLines({ itemPrice: order.itemAmount, shippingPrice: order.shippingAmount, protectionFee: order.protectionFee, total: order.totalAmount })

  return (
    <div className="container page">
      <p>
        <Link to="/my/orders">← Zamówienia</Link>
      </p>
      <h1>{order.itemTitle}</h1>
      <p>
        <span className={`order-status tone-${statusTone(order.status)}`}>{statusLabel(order.status, order.fulfillment)}</span>{' '}
        <span className="muted">
          {order.number} · {order.fulfillment === 'protected' ? 'Kup z Ochroną Bidigo' : 'Transakcja bezpośrednia'}
        </span>
      </p>
      {returned && order.fulfillment === 'protected' && <PaymentStateBanner state={orderPayState(order.status)} />}
      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      <section className="order-card">
        <h3>Podsumowanie kosztów</h3>
        {order.fulfillment === 'protected' ? (
          <ul className="cost-lines">
            {summary.lines.map((l) => (
              <li key={l.key}>
                <span>{l.label}</span>
                <span>{formatPln(l.amount)}</span>
              </li>
            ))}
            <li className="cost-total">
              <strong>Razem</strong>
              <strong>{formatPln(summary.total)}</strong>
            </li>
          </ul>
        ) : (
          <>
            <p>Cena przedmiotu: <strong>{formatPln(order.itemAmount)}</strong></p>
            <p className="hint">
              Transakcja poza Ochroną Bidigo: umówcie się na odbiór osobisty lub wysyłkę w <Link to="/messages">czacie</Link>.
              Bidigo nie pobiera żadnej opłaty ani nie przyjmuje tu płatności.
            </p>
          </>
        )}
        {order.status === 'DELIVERED' && order.reportUntil && (
          <p className="hint">Problem możesz zgłosić do {new Date(order.reportUntil).toLocaleString('pl-PL')}. Potem zamówienie kończy się automatycznie.</p>
        )}
        {order.refundedAmount > 0 && <p>Zwrócono: <strong>{formatPln(order.refundedAmount)}</strong></p>}
        {order.status === 'AWAITING_PAYMENT' && order.paymentDueAt && (
          <p className="hint">Zapłać do {new Date(order.paymentDueAt).toLocaleString('pl-PL')} — potem zamówienie przechodzi na zwykłą transakcję bezpośrednią.</p>
        )}
      </section>

      {order.dispute && (
        <section className="order-card">
          <h3>Zgłoszony problem</h3>
          <p>{DISPUTE_STATUS[order.dispute.status] ?? order.dispute.status}</p>
          <p>{order.dispute.description}</p>
          {order.dispute.sellerResponse && <p><strong>Odpowiedź sprzedającego:</strong> {order.dispute.sellerResponse}</p>}
          {order.dispute.resolutionNote && <p><strong>Decyzja:</strong> {order.dispute.resolutionNote}</p>}
        </section>
      )}

      <div className="order-actions">
        {has('pay') && isBuyer && (
          <>
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => void pay()}>
              {order.status === 'PAYMENT_PROCESSING' ? 'Wróć do płatności w PayU' : `Zapłać ${formatPln(expected ?? order.totalAmount)} przez PayU`}
            </button>
            <p className="muted ship-note">{PAYU_NOTE}</p>
            {payu?.testMode && <p className="ship-notice" role="note">{PAYU_TEST_NOTE}</p>}
            {payu && !payu.ready && <p className="ship-notice" role="note">Płatności PayU nie są jeszcze włączone. Spróbuj później.</p>}
          </>
        )}
        {has('choose_direct') && (
          <button className="btn btn-outline" disabled={busy} onClick={() => void run(() => chooseDirect(order.id), 'Przechodzisz na transakcję bezpośrednią.')}>
            Kupuję bez ochrony
          </button>
        )}
        {isBuyer && order.fulfillment === 'protected' && order.status === 'AWAITING_SHIPMENT' && (
          <Link className="btn btn-primary" to={`/shipping/checkout/${order.auctionId}?protection=1`}>Wybierz Paczkomat InPost</Link>
        )}
        {has('ship') && <button className="btn btn-primary" disabled={busy} onClick={() => setPanel('ship')}>Oznacz jako nadane</button>}
        {has('confirm_receipt') && (
          <button className="btn btn-primary" disabled={busy} onClick={() => void run(() => confirmReceipt(order.id), 'Dziękujemy! Transakcja zakończona.')}>
            {order.fulfillment === 'protected' ? 'Potwierdzam odbiór' : 'Transakcja zrealizowana'}
          </button>
        )}
        {has('report_problem') && <button className="btn btn-outline" disabled={busy} onClick={() => setPanel('problem')}>Zgłoś problem</button>}
        {has('respond_dispute') && <button className="btn btn-outline" disabled={busy} onClick={() => setPanel('respond')}>Odpowiedz na zgłoszenie</button>}
        {has('cancel') && <button className="btn btn-outline" disabled={busy} onClick={() => setPanel('cancel')}>Anuluj zamówienie</button>}
      </div>

      {panel === 'problem' && (
        <form className="order-card" onSubmit={(e) => { e.preventDefault(); void run(() => reportProblem(order.id, kind, text), 'Zgłoszenie wysłane — rozpatrzymy je i dostaniesz odpowiedź.') }}>
          <h3>Zgłoś problem z zamówieniem</h3>
          <label>
            <span className="label-text">Co się stało?</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {PROBLEM_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label-text">Opis (min. 10 znaków)</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} required />
          </label>
          <button className="btn btn-primary" disabled={busy || text.trim().length < 10} type="submit">Wyślij zgłoszenie</button>
        </form>
      )}
      {panel === 'respond' && (
        <form className="order-card" onSubmit={(e) => { e.preventDefault(); void run(() => respondDispute(order.id, text), 'Odpowiedź wysłana.') }}>
          <h3>Twoja odpowiedź</h3>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} required />
          <button className="btn btn-primary" disabled={busy || text.trim().length < 5} type="submit">Wyślij odpowiedź</button>
        </form>
      )}
      {panel === 'ship' && (
        <form className="order-card" onSubmit={(e) => { e.preventDefault(); void run(() => markShipped(order.id, text.trim() || null), 'Paczka oznaczona jako nadana.') }}>
          <h3>Nadano paczkę w Paczkomacie</h3>
          <label>
            <span className="label-text">Numer przesyłki (opcjonalnie)</span>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} />
          </label>
          <button className="btn btn-primary" disabled={busy} type="submit">Potwierdź nadanie</button>
        </form>
      )}
      {panel === 'cancel' && (
        <form className="order-card" onSubmit={(e) => { e.preventDefault(); void run(() => cancelOrder(order.id, text), 'Zamówienie anulowane.') }}>
          <h3>Anulować zamówienie?</h3>
          {order.status === 'AWAITING_SHIPMENT' && order.fulfillment === 'protected' && <p className="hint">Płatność zostanie zwrócona w całości, łącznie z opłatą za ochronę.</p>}
          <label>
            <span className="label-text">Powód (opcjonalnie)</span>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          </label>
          <button className="btn btn-primary" disabled={busy} type="submit">Anuluj zamówienie</button>
        </form>
      )}

      {order.history && order.history.length > 0 && (
        <section className="order-card">
          <h3>Historia</h3>
          <ul className="order-timeline">
            {order.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString('pl-PL')} — <strong>{statusLabel(h.to, order.fulfillment)}</strong>
                {h.note ? <span className="muted"> ({h.note})</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
