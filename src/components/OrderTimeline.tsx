import { orderTimeline } from '../lib/checkout'
import type { OrderStatus } from '../lib/ordersLogic'
import './checkout.css'

/** Oś statusów zamówienia z Ochroną: Opłacone → … → Środki trafiły do sprzedającego. */
export function OrderTimeline({ status, payoutStatus }: { status: OrderStatus; payoutStatus?: string | null }) {
  const steps = orderTimeline({ status }, payoutStatus)
  return (
    <ol className="order-timeline" aria-label="Postęp zamówienia" data-testid="order-timeline">
      {steps.map((s) => (
        <li key={s.key} className={`tl-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span className="tl-dot" aria-hidden="true">{s.state === 'done' ? '✓' : s.state === 'blocked' ? '!' : ''}</span>
          <span className="tl-label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
