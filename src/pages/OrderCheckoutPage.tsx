import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DeliveryCheckout, type DeliveryChoice } from '../components/DeliveryCheckout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { acceptOrderTerms, fetchCheckoutState, fetchOrder, fetchPayuStatus, setOrderDelivery, startOrderCheckout, type CheckoutState, type PayuStatus } from '../lib/ordersApi'
import { paymentDeadline } from '../lib/checkout'
import type { Order } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { shippingConfig, type ShippingConfig } from '../lib/shipping'
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
  const [resetTerms, setResetTerms] = useState(0)
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

  if (!user) return <div className="checkout-page"><p><Link to="/login">Zaloguj się</Link>, żeby zapłacić za zamówienie.</p></div>
  if (!order) return <div className="checkout-page">{error ? <p className="error">{error}</p> : <p className="muted">Ładowanie…</p>}</div>
  if (order.role !== 'buyer' || order.fulfillment !== 'protected' || !['AWAITING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.status)) {
    nav(`/my/orders/${order.id}`, { replace: true })
    return null
  }

  const payuReady = !!payu?.ready && payu.marketplaceEnabled !== false
  const processing = order.status === 'PAYMENT_PROCESSING'

  async function pay(c: DeliveryChoice) {
    if (!order || !state) return
    setBusy(true)
    setError(null)
    try {
      if (!processing) {
        await setOrderDelivery(order.id, c.code, c.name ?? state.delivery?.lockerName ?? null, c.phone)
        await acceptOrderTerms(order.id, state.termsVersion)
      }
      const r = await startOrderCheckout(order.id, order.totalAmount)
      if (r.status === 'total_changed') {
        setNotice(`Koszt zamówienia się zmienił. Nowa kwota do zapłaty: ${formatPln(r.total)}. Sprawdź podsumowanie i zapłać jeszcze raz.`)
        setResetTerms((n) => n + 1)
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

  const d = paymentDeadline(order, Date.now())
  async function writeToSeller() {
    if (!order) return
    try {
      const { data: convo, error: err } = await supabase.rpc('get_or_create_conversation', { p_auction_id: order.auctionId })
      if (err) throw err
      nav(`/messages/${(convo as { id: string }).id}`)
    } catch {
      nav(`/auction/${order.auctionId}?ask=1`)
    }
  }

  return (
    <div className="container page buy-page">
      <p><Link to={`/my/orders/${order.id}`}>← Zamówienie {order.number}</Link></p>
      <h1>Kup z dostawą</h1>
      <DeliveryCheckout
        product={{ image: order.imageUrl, title: order.itemTitle, seller: order.sellerName, to: `/auction/${order.auctionId}` }}
        item={order.itemAmount} shipping={order.shippingAmount} protection={order.protectionFee} total={order.totalAmount}
        cfg={cfg} payuReady={payuReady} payuTest={payu?.testMode}
        recipient={order.buyerName} defaultPhone={profile?.phone ?? null} initialLockerCode={state?.delivery?.lockerCode} initialPhone={state?.delivery?.phone}
        dueAt={order.paymentDueAt} dueConsequence={d?.consequence ?? (order.source === 'buy_now' ? 'Po tym terminie rezerwacja wygaśnie, a zamówienie zostanie anulowane.' : undefined)}
        reportWindowHours={state?.reportWindowHours ?? null} processing={processing} busy={busy} error={error} notice={notice} resetTerms={resetTerms}
        onPay={(c) => void pay(c)} onWriteToSeller={() => void writeToSeller()}
      />
    </div>
  )
}
