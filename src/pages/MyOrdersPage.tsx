import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { fetchMyOrders } from '../lib/ordersApi'
import { SellerPayuBanner } from '../components/SellerPayuBanner'
import { statusLabel, statusTone, type Order } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'
import { errorMessage } from '../lib/errors'
import './shipping.css'

export function MyOrdersPage() {
  const { user } = useAuth()
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setOrders(null)
    fetchMyOrders(role)
      .then((o) => !cancelled && setOrders(o))
      .catch((e) => !cancelled && setError(errorMessage(e, 'Nie udało się wczytać zamówień')))
    return () => {
      cancelled = true
    }
  }, [user, role])

  if (!user) {
    return (
      <div className="container page">
        <p>
          <Link to="/login">Zaloguj się</Link>, żeby zobaczyć zamówienia.
        </p>
      </div>
    )
  }

  return (
    <div className="container page">
      <h1>Zamówienia</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={role === 'buyer'} className={role === 'buyer' ? 'tab on' : 'tab'} onClick={() => setRole('buyer')}>
          Moje zakupy
        </button>
        <button role="tab" aria-selected={role === 'seller'} className={role === 'seller' ? 'tab on' : 'tab'} onClick={() => setRole('seller')}>
          Moje sprzedaże
        </button>
      </div>
      {role === 'seller' && <SellerPayuBanner />}
      {error && <p className="error">{error}</p>}
      {orders === null && !error && <p className="muted">Ładowanie…</p>}
      {orders?.length === 0 && <p className="muted">{role === 'buyer' ? 'Nie masz jeszcze zakupów.' : 'Nie masz jeszcze sprzedaży.'}</p>}
      <ul className="order-list">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link to={`/my/orders/${o.id}`} className="order-row">
              <span className="order-title">{o.itemTitle}</span>
              <span className={`order-status tone-${statusTone(o.status)}`}>{statusLabel(o.status, o.fulfillment)}</span>
              <span className="order-amount">{formatPln(o.fulfillment === 'protected' ? o.totalAmount : o.itemAmount)}</span>
              <span className="muted order-meta">
                {o.number} · {o.fulfillment === 'protected' ? 'z Ochroną Bidigo' : 'bezpośrednio'} · {role === 'buyer' ? o.sellerName : o.buyerName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
