import { useEffect, useRef, useState } from 'react'
import { formatPln } from '../lib/format'

type BidSheetProps = {
  open: boolean
  onClose: () => void
  minBid: number
  /** Highest amount allowed for a bid (just below "Kup teraz"), null when there is no such cap */
  maxAllowed: number | null
  step: number
  buyNowPrice: number | null
  /** The bidder's current private limit on this auction, null when none (then the sheet edits it) */
  currentLimit?: number | null
  /** Current auction price when the bidder leads: a limit may then also be lowered, down to this price */
  leadingPrice?: number | null
  busy: boolean
  error: string | null
  /** Places the bid; resolves true on success so the sheet can close */
  onBid: (amount: number, max: number | null) => Promise<boolean>
  onBuyNow: () => void
}

/** Phone bidding flow like ricardo.ch: confirm the next bid, or set an auction limit (auto-bidding up to it). */
export function BidSheet({ open, onClose, minBid, maxAllowed, step, buyNowPrice, currentLimit = null, leadingPrice = null, busy, error, onBid, onBuyNow }: BidSheetProps) {
  const [mode, setMode] = useState<'confirm' | 'limit'>('confirm')
  // The leader may move the limit either way (down to the current price); otherwise it can only go up
  const floor = currentLimit != null && leadingPrice != null ? leadingPrice : minBid
  const [limit, setLimit] = useState(String(floor))
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setMode(currentLimit != null ? 'limit' : 'confirm')
    setLimit(String(floor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onClose])

  if (!open) return null

  const lim = Number(limit)
  const limitOk = Number.isFinite(lim) && lim >= floor && (maxAllowed == null || lim <= maxAllowed)
  const clamp = (v: number) => Math.max(floor, maxAllowed != null ? Math.min(v, maxAllowed) : v)
  const nudge = (dir: 1 | -1) => setLimit(String(clamp((Number.isFinite(lim) ? lim : floor) + dir * step)))

  const amount = mode === 'confirm' ? minBid : lim
  const title = mode === 'confirm' ? `Potwierdź ofertę ${formatPln(minBid)}` : currentLimit != null ? 'Zmień limit aukcji' : 'Ustaw limit aukcji'
  const lead =
    mode === 'confirm'
      ? 'To może być wygrywająca oferta. Pamiętaj, że oferty są wiążące.'
      : 'Podbijemy Twoją ofertę za Ciebie, tylko tyle ile trzeba, aż do tej kwoty. Pamiętaj, że oferty są wiążące.'

  return (
    <div className="bidsheet-root" role="presentation">
      <button type="button" className="bidsheet-backdrop" aria-label="Zamknij" onClick={() => !busy && onClose()} />
      <div className="bidsheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={sheetRef}>
        <button type="button" className="bidsheet-x" aria-label="Zamknij" disabled={busy} onClick={onClose}>
          ×
        </button>
        <h2>{title}</h2>
        <p className="bidsheet-lead">{lead}</p>
        {mode === 'limit' && currentLimit != null && (
          <p className="bidsheet-lead">
            Twój obecny limit: <b>{formatPln(currentLimit)}</b>. Zmienisz go w górę lub w dół, najniżej do aktualnej ceny.
          </p>
        )}

        {mode === 'limit' && (
          <div className="bidsheet-picker">
            <button type="button" aria-label="Zmniejsz limit" disabled={busy || lim <= floor} onClick={() => nudge(-1)}>
              −
            </button>
            <label>
              <span className="bidsheet-sr">Limit w złotych</span>
              <input
                type="number"
                inputMode="decimal"
                min={floor}
                max={maxAllowed ?? undefined}
                step="1"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
              <span aria-hidden>zł</span>
            </label>
            <button
              type="button"
              aria-label="Zwiększ limit"
              disabled={busy || (maxAllowed != null && lim >= maxAllowed)}
              onClick={() => nudge(1)}
            >
              +
            </button>
          </div>
        )}

        <dl className="bidsheet-sum">
          <div>
            <dt>{mode === 'confirm' ? 'Cena oferty' : 'Twój limit'}</dt>
            <dd>{formatPln(Number.isFinite(amount) ? amount : 0)}</dd>
          </div>
          {mode === 'limit' && leadingPrice == null && (
            <div>
              <dt>Najpierw złożymy</dt>
              <dd>{formatPln(minBid)}</dd>
            </div>
          )}
          <div className="is-total">
            <dt>{mode === 'confirm' ? 'Razem' : 'Najwyżej zapłacisz'}</dt>
            <dd>{formatPln(Number.isFinite(amount) ? amount : 0)}</dd>
          </div>
        </dl>
        <p className="bidsheet-note">Dostawę lub odbiór osobisty ustalasz ze sprzedającym.</p>

        {mode === 'limit' && !limitOk && (
          <p className="error" role="alert">
            Limit musi wynosić od {formatPln(floor)}
            {maxAllowed != null ? ` do ${formatPln(maxAllowed)}` : ''}.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="bidsheet-actions">
          {mode === 'confirm' ? (
            <>
              <button
                type="button"
                className="bidsheet-primary"
                disabled={busy}
                onClick={() => void onBid(minBid, null).then((ok) => ok && onClose())}
              >
                {busy ? 'Składanie…' : `Potwierdź ofertę ${formatPln(minBid)}`}
              </button>
              <button type="button" className="bidsheet-secondary" disabled={busy} onClick={() => setMode('limit')}>
                Ustaw limit aukcji
              </button>
              {buyNowPrice != null && (
                <button type="button" className="bidsheet-link" disabled={busy} onClick={onBuyNow}>
                  Kup teraz · {formatPln(buyNowPrice)}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="bidsheet-primary"
                disabled={busy || !limitOk}
                onClick={() => void onBid(minBid, lim).then((ok) => ok && onClose())}
              >
                {busy ? 'Składanie…' : `Potwierdź limit ${formatPln(Number.isFinite(lim) ? lim : 0)}`}
              </button>
              <button type="button" className="bidsheet-secondary" disabled={busy} onClick={() => setMode('confirm')}>
                Wróć
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
