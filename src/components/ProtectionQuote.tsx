import { useEffect, useState } from 'react'
import { fetchQuote } from '../lib/ordersApi'
import { costLines, quoteMessage, type Quote } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'

/**
 * Next to „Kup teraz”: what "Kup z Ochroną Bidigo" would cost, or why the item does not qualify. The numbers and the
 * qualification come only from the backend (order_quote). Nothing is shown while the service is off.
 */
export function ProtectionQuote({ auctionId, price }: { auctionId: string; price: number }) {
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchQuote(auctionId, price)
      .then((q) => !cancelled && setQuote(q))
      .catch(() => !cancelled && setQuote(null))
    return () => {
      cancelled = true
    }
  }, [auctionId, price])

  if (!quote) return null
  if (quote.eligible) {
    const c = costLines(quote)
    return (
      <div className="protection-quote protection-quote--yes">
        <h4>Kup z Ochroną Bidigo</h4>
        <ul className="cost-lines">
          {c.lines.map((l) => (
            <li key={l.key}>
              <span>{l.label}</span>
              <span>{formatPln(l.amount)}</span>
            </li>
          ))}
          <li className="cost-total">
            <strong>Razem</strong>
            <strong>{formatPln(c.total)}</strong>
          </li>
        </ul>
        <p className="hint">Płacisz w Bidigo, a pieniądze są zwracane, gdy paczka nie dotrze lub jest niezgodna z opisem. To opcja — możesz też kupić bez ochrony.</p>
      </div>
    )
  }
  const text = quoteMessage(quote)
  return text ? <p className="protection-quote protection-quote--no hint">{text}</p> : null
}
