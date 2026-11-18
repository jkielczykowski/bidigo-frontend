import { costLines, type Quote } from '../lib/ordersLogic'
import { formatPln } from '../lib/format'
import './checkout.css'

/**
 * Okno „Kup teraz”: jedna ścieżka, zakup z Ochroną Kupującego. Podsumowanie (cena + dostawa + opłata za Ochronę = razem) i „Przejdź do płatności”.
 * Kto chce kupić bez Ochrony, ustala to ze sprzedającym poza Bidigo (bez tworzenia zamówienia).
 */
export function BuyNowSummary({ quote, busy, onPay, onCancel, onWriteToSeller }: {
  quote: Quote
  busy: boolean
  onPay: () => void
  onCancel: () => void
  /** link pomocniczy; null = niedostępny (np. czat ze sprzedającym działa dopiero po sprzedaży) */
  onWriteToSeller: (() => void) | null
}) {
  const c = costLines(quote)
  return (
    <div className="buy-choices" data-testid="buy-now-summary">
      <section className="buy-choice on">
        <h4>Podsumowanie zakupu z Ochroną Kupującego</h4>
        <ul className="cost-lines">
          {c.lines.map((l) => <li key={l.key}><span>{l.label}</span><span>{formatPln(l.amount)}</span></li>)}
          <li className="cost-total"><strong>Razem</strong><strong>{formatPln(c.total)}</strong></li>
        </ul>
        <p className="hint">Płacisz raz przez PayU. Pieniądze za przedmiot czekają u operatora, dopóki nie potwierdzisz odbioru. Przedmiot zostanie zarezerwowany na czas płatności (limit ustawia Bidigo); jeśli nie zapłacisz w terminie, rezerwacja wygaśnie i zamówienie zostanie anulowane. Wybierzesz Paczkomat i zobaczysz pełne podsumowanie, zanim zapłacisz.</p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onPay}>{busy ? 'Przechodzenie…' : 'Przejdź do płatności'}</button>
      </section>
      {onWriteToSeller && (
        <p className="hint">
          Wolisz ustalić zakup bezpośrednio?{' '}
          <button type="button" className="bidsheet-link" disabled={busy} onClick={onWriteToSeller}>Napisz do sprzedawcy</button>
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Anuluj</button>
      </div>
    </div>
  )
}
