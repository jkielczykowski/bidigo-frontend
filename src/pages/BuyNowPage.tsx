import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DeliveryCheckout, type DeliveryChoice } from '../components/DeliveryCheckout'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  acceptOrderTerms, fetchCheckoutState, fetchOrderForAuction, fetchPayuStatus, fetchProtectionPriceLimit, fetchQuote, setOrderDelivery, startOrderCheckout,
  type CheckoutState, type PayuStatus,
} from '../lib/ordersApi'
import { buyChoices, buyNowUnavailableText } from '../lib/checkout'
import type { Quote } from '../lib/ordersLogic'
import { errorMessage } from '../lib/errors'
import { shippingConfig, type ShippingConfig } from '../lib/shipping'
import '../components/checkout.css'

type A = { id: string; title: string; seller_id: string; status: string; buy_now_price: number | null; image_urls: string[] | null; seller: { display_name?: string | null; username?: string | null } | null }

/**
 * „Kup z dostawą” dla „Kup teraz”: cała kasa na jednej stronie, jeszcze przed zamówieniem (dostawa → podsumowanie z Ochroną → zgoda → PayU).
 * Aukcja kończy się dopiero po „Zapłać przez PayU”. Oferta, której Ochrona nie obejmuje, nie ma tu zakupu: jest powód i „Napisz do sprzedawcy”.
 */
export function BuyNowPage() {
  const { id = '' } = useParams()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [a, setA] = useState<A | null>(null)
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined)
  const [payu, setPayu] = useState<PayuStatus | null | undefined>(undefined)
  const [limit, setLimit] = useState<number | null>(null)
  const [cfg, setCfg] = useState<ShippingConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void supabase.from('auctions').select('id,title,seller_id,status,buy_now_price,image_urls,seller:profiles!auctions_seller_id_fkey(display_name,username)').eq('id', id).single()
      .then(({ data, error: e }) => { if (e) setLoadError(e.message); else setA(data as unknown as A) })
    void fetchPayuStatus().then(setPayu).catch(() => setPayu(null))
    void shippingConfig().then(setCfg).catch(() => {})
    void fetchProtectionPriceLimit().then(setLimit).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!a || a.buy_now_price == null) return
    void fetchQuote(a.id, Number(a.buy_now_price)).then(setQuote).catch(() => setQuote(null))
  }, [a])

  if (!user) return <div className="container page"><p><Link to="/login">Zaloguj się</Link>, żeby kupić z dostawą.</p></div>
  if (loadError) return <div className="container page"><p className="error">{loadError}</p><Link to="/">Wróć do ogłoszeń</Link></div>
  if (!a || quote === undefined || payu === undefined) return <div className="container page"><p className="muted">Ładowanie…</p></div>

  const back = `/auction/${a.id}`
  const sellerName = a.seller?.display_name ?? a.seller?.username ?? null
  const askSeller = () => nav(`${back}?ask=1`)
  const live = a.status === 'active'
  const own = a.seller_id === user.id
  const offered = live && !own && a.buy_now_price != null && buyChoices(quote, payu).protection.available

  // brak zakupu: zawsze powód i jedna akcja
  if (!offered) {
    const text = !live ? 'Ta aukcja jest już zakończona.'
      : own ? 'To Twoja oferta.'
      : a.buy_now_price == null ? 'Ta oferta nie ma ceny „Kup teraz”.'
      : quote && !quote.eligible ? buyNowUnavailableText(quote.reason, limit)
      : !quote ? 'Nie udało się sprawdzić, czy Ochrona jest dostępna. Spróbuj ponownie za chwilę.'
      : 'Płatności PayU są chwilowo niedostępne, więc zakup z Ochroną jest teraz niemożliwy. Napisz do sprzedawcy.'
    return (
      <div className="container page">
        <div className="dc-unavailable" data-testid="buy-unavailable">
          <h1>Kup teraz jest niedostępne</h1>
          <p>{a.title}</p>
          <p data-testid="buy-unavailable-reason">{text}</p>
          {live && !own && <button type="button" className="btn btn-primary btn-lg" onClick={askSeller}>Napisz do sprzedawcy</button>}
          <Link to={back}>← Wróć do ogłoszenia</Link>
        </div>
      </div>
    )
  }

  async function pay(d: DeliveryChoice) {
    setBusy(true)
    setError(null)
    let orderId: string | null = null
    try {
      let order = await fetchOrderForAuction(a!.id).catch(() => null)
      if (!order) {
        const { error: err } = await supabase.rpc('buy_now', { p_auction_id: a!.id })
        if (err) throw err
        order = await fetchOrderForAuction(a!.id)
      }
      if (!order) throw new Error('Nie udało się utworzyć zamówienia')
      orderId = order.id
      const state: CheckoutState = await fetchCheckoutState(order.id)
      await setOrderDelivery(order.id, d.code, d.name, d.phone)
      await acceptOrderTerms(order.id, state.termsVersion)
      const r = await startOrderCheckout(order.id, order.totalAmount)
      if (r.status === 'total_changed') {
        nav(`/my/orders/${order.id}/checkout`)
        return
      }
      window.location.assign(r.checkoutUrl)
    } catch (e) {
      setError(errorMessage(e, 'Nie udało się rozpocząć płatności'))
      // zamówienie już jest (rezerwacja trwa): dokończ w kasie zamówienia
      if (orderId) setTimeout(() => nav(`/my/orders/${orderId}/checkout`), 1500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page buy-page">
      <p><Link to={back}>← Wróć do ogłoszenia</Link></p>
      <h1>Kup z dostawą</h1>
      <DeliveryCheckout
        product={{ image: a.image_urls?.[0] ?? null, title: a.title, seller: sellerName, to: back }}
        item={quote!.itemPrice} shipping={quote!.shippingPrice} protection={quote!.protectionFee} total={quote!.total}
        cfg={cfg} payuReady={!!payu?.ready} payuTest={payu?.testMode}
        recipient={profile?.display_name ?? null} defaultPhone={profile?.phone ?? null}
        busy={busy} error={error} onPay={(d) => void pay(d)} onWriteToSeller={askSeller}
      />
    </div>
  )
}
