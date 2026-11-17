import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchPayuStatus, fetchQuote, type PayuStatus } from '../lib/ordersApi'
import { DIRECT_CONSEQUENCES, buyChoices } from '../lib/checkout'
import { costLines, type Quote } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'
import './checkout.css'

const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL as string | undefined)?.replace(/\/+$/, '') ?? 'https://panel.bidigo.pl'

/**
 * „Kup teraz”: dwa wyraźne wybory zamiast jednego przycisku. Kwalifikację i kwoty zwraca backend (order_quote), gotowość płatności PayU:
 * /payments/payu/status. Gdy Ochrona jest niedostępna, jedno zdanie mówi dlaczego. Nic nie jest zaznaczone domyślnie.
 */
export function BuyNowChoices({ auctionId, price, busy, lockerOk = true, onProtected, onDirect, onCancel }: {
  auctionId: string
  /** kategoria dopuszcza Paczkomat (V110); false = w ogóle nie pokazujemy Ochrony ani dostawy */
  lockerOk?: boolean
  price: number
  busy: boolean
  onProtected: () => void
  onDirect: () => void
  onCancel: () => void
}) {
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined)
  const [payu, setPayu] = useState<PayuStatus | null>(null)
  const [confirmDirect, setConfirmDirect] = useState(false)
  const { profile } = useAuth()

  useEffect(() => {
    let off = false
    fetchQuote(auctionId, price).then((q) => !off && setQuote(q)).catch(() => !off && setQuote(null))
    fetchPayuStatus().then((s) => !off && setPayu(s)).catch(() => !off && setPayu(null))
    return () => { off = true }
  }, [auctionId, price])

  if (quote === undefined) return <p className="muted">Sprawdzamy dostępne opcje…</p>
  const c = buyChoices(quote, payu)
  const cost = quote && quote.eligible ? costLines(quote) : null

  return (
    <div className="buy-choices">
      {lockerOk && <section className={`buy-choice${c.protection.available ? ' on' : ' off'}`} data-testid="choice-protected">
        <h4>Kup z dostawą i Ochroną Bidigo</h4>
        {c.protection.available && cost ? (
          <>
            <ul className="cost-lines">
              {cost.lines.map((l) => <li key={l.key}><span>{l.label}</span><span>{formatPln(l.amount)}</span></li>)}
              <li className="cost-total"><strong>Razem do zapłaty</strong><strong>{formatPln(cost.total)}</strong></li>
            </ul>
            <p className="hint">Płacisz raz przez PayU. Pieniądze za przedmiot czekają u operatora, dopóki nie potwierdzisz odbioru. Przedmiot zostanie zarezerwowany na czas płatności (limit ustawia Bidigo); jeśli nie zapłacisz w terminie, rezerwacja wygaśnie i zamówienie zostanie anulowane. Wybierzesz Paczkomat i zobaczysz podsumowanie, zanim zapłacisz.</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onProtected}>Kup z dostawą i Ochroną Bidigo</button>
          </>
        ) : (
          <>
            <p className="buy-choice-why" role="note">{c.protection.reason}</p>
            {/* admin widzi, że to brak konfiguracji, i dostaje link do panelu */}
            {profile?.is_admin && c.protection.configIssue && (
              <p><a href={`${ADMIN_URL}/ochrona`} target="_blank" rel="noopener noreferrer">Skonfiguruj w panelu</a></p>
            )}
          </>
        )}
      </section>}

      <section className="buy-choice" data-testid="choice-direct">
        <h4>Kup bezpośrednio od sprzedającego</h4>
        <p className="hint">Bez Ochrony i bez płatności w Bidigo. {price != null && <>Cena przedmiotu: <strong>{formatPln(price)}</strong>.</>}</p>
        {!confirmDirect ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setConfirmDirect(true)}>Kup bezpośrednio od sprzedającego</button>
        ) : (
          <div className="buy-choice-confirm">
            <p>{DIRECT_CONSEQUENCES}</p>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={onDirect}>Rozumiem, kupuję bezpośrednio</button>
          </div>
        )}
      </section>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Anuluj</button>
      </div>
    </div>
  )
}
