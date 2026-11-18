import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchOrderForAuction } from '../lib/ordersApi'
import { SHIPPING_SOON } from '../lib/shipping'
import { DIRECT_CONSEQUENCES, paymentDeadline } from '../lib/checkout'
import type { Order } from '../lib/ordersLogic'
import './checkout.css'

/**
 * Ekran wygranej / zakupu: kupujący widzi dwa wyraźne wybory (kasa z Ochroną albo zakup bezpośredni), a nie jeden niejasny przycisk.
 * Co jest dostępne, mówi backend (rodzaj zamówienia i jego status); bez Ochrony zostaje tylko transakcja bezpośrednia.
 */
export function WinnerOrderCta({ auctionId, shippingReady, lockerOk = true }: { auctionId: string; shippingReady: boolean; lockerOk?: boolean }) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  useEffect(() => {
    let off = false
    fetchOrderForAuction(auctionId).then((o) => !off && setOrder(o)).catch(() => !off && setOrder(null))
    return () => { off = true }
  }, [auctionId])
  const nav = useNavigate()
  async function writeToSeller() {
    const { data, error } = await supabase.rpc('get_or_create_conversation', { p_auction_id: auctionId })
    if (!error && data) nav(`/messages/${(data as { id: string }).id}`)
  }
  if (order === undefined) return null
  if (!order) {
    if (!lockerOk) return null // kategoria nie dopuszcza Paczkomatu (V110): żadnych przycisków dostawy ani Ochrony
    return shippingReady
      ? <Link className="btn btn-outline" to={`/shipping/checkout/${auctionId}`}>Wybierz dostawę Paczkomatem InPost</Link>
      : <p className="hint">{SHIPPING_SOON}</p>
  }
  if (lockerOk && order.fulfillment === 'protected' && order.status === 'AWAITING_PAYMENT') {
    return (
      <div className="buy-choices" data-testid="winner-choices">
        <section className="buy-choice on">
          <h4>Zapłać z Ochroną Bidigo</h4>
          {(() => { const d = paymentDeadline(order, Date.now()); return d && <p data-testid="payment-deadline"><strong>{d.title}.</strong> {d.consequence}</p> })()}
          <p className="hint">Wybierz Paczkomat, zobacz podsumowanie kosztów i zapłać raz przez PayU. Pieniądze czekają u operatora, dopóki nie potwierdzisz odbioru.</p>
          <Link className="btn btn-primary" to={`/my/orders/${order.id}/checkout`}>Zapłać z Ochroną</Link>
        </section>
        <p className="hint" data-testid="direct-hint">
          Wolisz ustalić zakup bezpośrednio ze sprzedającym? Napisz do niego w czacie. {DIRECT_CONSEQUENCES}{' '}
          <button type="button" className="bidsheet-link" onClick={() => void writeToSeller()}>Napisz do sprzedawcy</button>
        </p>
      </div>
    )
  }
  return <Link className="btn btn-primary" to={`/my/orders/${order.id}`}>Przejdź do zamówienia</Link>
}
