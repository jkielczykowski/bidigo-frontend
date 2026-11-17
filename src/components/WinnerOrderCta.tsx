import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOrderForAuction } from '../lib/ordersApi'
import { SHIPPING_SOON } from '../lib/shipping'
import { DIRECT_CONSEQUENCES, paymentDeadline } from '../lib/checkout'
import type { Order } from '../lib/ordersLogic'
import './checkout.css'

/**
 * Ekran wygranej / zakupu: kupujący widzi dwa wyraźne wybory (kasa z Ochroną albo zakup bezpośredni), a nie jeden niejasny przycisk.
 * Co jest dostępne, mówi backend (rodzaj zamówienia i jego status); bez Ochrony zostaje tylko transakcja bezpośrednia.
 */
export function WinnerOrderCta({ auctionId, shippingReady }: { auctionId: string; shippingReady: boolean }) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  useEffect(() => {
    let off = false
    fetchOrderForAuction(auctionId).then((o) => !off && setOrder(o)).catch(() => !off && setOrder(null))
    return () => { off = true }
  }, [auctionId])
  if (order === undefined) return null
  if (!order) {
    return shippingReady
      ? <Link className="btn btn-outline" to={`/shipping/checkout/${auctionId}`}>Wybierz dostawę Paczkomatem InPost</Link>
      : <p className="hint">{SHIPPING_SOON}</p>
  }
  if (order.fulfillment === 'protected' && order.status === 'AWAITING_PAYMENT') {
    return (
      <div className="buy-choices" data-testid="winner-choices">
        <section className="buy-choice on">
          <h4>Zapłać z Ochroną Bidigo</h4>
          {(() => { const d = paymentDeadline(order, Date.now()); return d && <p data-testid="payment-deadline"><strong>{d.title}.</strong> {d.consequence}</p> })()}
          <p className="hint">Wybierz Paczkomat, zobacz podsumowanie kosztów i zapłać raz przez PayU. Pieniądze czekają u operatora, dopóki nie potwierdzisz odbioru.</p>
          <Link className="btn btn-primary" to={`/my/orders/${order.id}/checkout`}>Zapłać z Ochroną</Link>
        </section>
        <section className="buy-choice">
          <h4>Kup bezpośrednio od sprzedającego</h4>
          <p className="hint">{DIRECT_CONSEQUENCES}</p>
          <Link className="btn btn-outline" to={`/my/orders/${order.id}`}>Wybierz zakup bezpośredni</Link>
        </section>
      </div>
    )
  }
  return <Link className="btn btn-primary" to={`/my/orders/${order.id}`}>Przejdź do zamówienia</Link>
}
