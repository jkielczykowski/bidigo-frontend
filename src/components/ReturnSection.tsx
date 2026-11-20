import { useState } from 'react'
import { confirmReturnReceived, disputeReturn, downloadReturnLabel, requestReturn, setReturnLocker } from '../lib/returnsApi'
import {
  RETURN_COST_NOTICE, RETURN_REASONS, buyerCanDownloadLabel, canRequestReturn, hasReturn, normalizeLockerCode, returnDeadlineText,
  returnStatusLabel, returnTone, sellerCanConfirm, sellerCanDispute, sellerNeedsLocker, sellerReturnText, validateReturnRequest, type ReturnInfo,
} from '../lib/returns'
import { formatPln } from '../lib/format'
import { errorMessage } from '../lib/errors'

type Props = { orderId: string; role: 'buyer' | 'seller' | 'admin' | null; info: ReturnInfo | null; now: number; onChanged: () => void }

/** Zwrot na koszt Bidigo (Ochrona Kupującego): zgłoszenie, list zwrotny, status; dla sprzedającego potwierdzenie odbioru i zgłoszenie problemu. */
export function ReturnSection({ orderId, role, info, now, onChanged }: Props) {
  const [panel, setPanel] = useState<'request' | 'dispute' | null>(null)
  const [reason, setReason] = useState('changed_mind')
  const [locker, setLocker] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setPanel(null)
      setText('')
      setNotice(done)
      onChanged()
    } catch (e) {
      setError(errorMessage(e, 'Nie udało się wykonać operacji'))
    } finally {
      setBusy(false)
    }
  }

  if (role !== 'buyer' && role !== 'seller') return null
  const has = hasReturn(info)
  const canRequest = canRequestReturn(info, role)
  if (!has && !canRequest) return null

  const errors = validateReturnRequest(reason, text)
  const deadline = info ? returnDeadlineText(info, now) : null

  return (
    <section className="order-card return-card" data-testid="return-section">
      <h3>Zwrot przedmiotu</h3>
      {!has && !canRequest && info?.cannotRequestReason && <p className="hint">{info.cannotRequestReason}</p>}
      {has && info && (
        <p>
          <span className={`order-status tone-${returnTone(info.status)}`} data-testid="return-status">{returnStatusLabel(info)}</span>
        </p>
      )}
      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {role === 'buyer' && canRequest && panel !== 'request' && (
        <>
          <p className="hint">{RETURN_COST_NOTICE}</p>
          {deadline && <p className="order-countdown">{deadline}</p>}
          <button type="button" className="btn btn-outline" onClick={() => setPanel('request')}>Zwróć przedmiot (na koszt Bidigo)</button>
        </>
      )}
      {role === 'buyer' && canRequest && panel === 'request' && (
        <form data-testid="return-form" onSubmit={(e) => { e.preventDefault(); void run(() => requestReturn(orderId, reason, text), 'Zwrot zgłoszony. Gdy list zwrotny będzie gotowy, pobierzesz go tutaj.') }}>
          <p className="hint">{RETURN_COST_NOTICE}</p>
          <label>
            <span className="label-text">Powód zwrotu</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label-text">Dodatkowy opis{reason === 'other' ? ' (wymagany)' : ' (opcjonalnie)'}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} />
          </label>
          {errors.note && <p className="error">{errors.note}</p>}
          <div className="order-actions">
            <button className="btn btn-primary" disabled={busy || !!errors.reason || !!errors.note} type="submit">Zgłoś zwrot i pobierz list</button>
            <button className="btn btn-outline" type="button" onClick={() => setPanel(null)}>Rezygnuję</button>
          </div>
        </form>
      )}

      {has && info?.refundState === 'pending' && <p className="hint">Zwrot pieniędzy jest w toku.</p>}
      {has && info?.refundState === 'failed' && <p className="hint">Zwrot pieniędzy nie powiódł się — Bidigo ponowi go lub zajmie się sprawą.</p>}
      {role === 'buyer' && has && info && (
        <>
          {info.status !== 'refunded' && <p className="hint">{RETURN_COST_NOTICE}</p>}
          {info.refundAmount != null && <p>Kwota zwrotu: <strong>{formatPln(info.refundAmount)}</strong></p>}
          {info.trackingNumber && <p>Numer przesyłki zwrotnej: <strong>{info.trackingNumber}</strong></p>}
          {deadline && <p className="order-countdown">{deadline}</p>}
          {buyerCanDownloadLabel(info, role) && (
            <p data-testid="return-label">
              <button type="button" className="btn btn-primary" onClick={() => void downloadReturnLabel(orderId).catch((e) => setError(errorMessage(e, 'Nie udało się pobrać listu zwrotnego')))}>Pobierz list zwrotny (PDF)</button>
            </p>
          )}
        </>
      )}

      {role === 'seller' && has && info && (
        <>
          <p>{sellerReturnText(info)}</p>
          {info.refundAmount != null && <p>Kwota zwrotu dla kupującego: <strong>{formatPln(info.refundAmount)}</strong></p>}
          {info.trackingNumber && <p>Numer przesyłki zwrotnej: <strong>{info.trackingNumber}</strong></p>}
          {deadline && <p className="order-countdown">{deadline}</p>}
          {sellerNeedsLocker(info, role) && (
            <form data-testid="return-locker-form" onSubmit={(e) => { e.preventDefault(); const c = normalizeLockerCode(locker); if (c) void run(() => setReturnLocker(orderId, c), 'Paczkomat zwrotu zapisany. Przygotowujemy list zwrotny.') }}>
              <label>
                <span className="label-text">Paczkomat, do którego ma wrócić paczka (kod, np. WAW22M)</span>
                <input value={locker} onChange={(e) => setLocker(e.target.value)} maxLength={12} required />
              </label>
              <button className="btn btn-primary" disabled={busy || !normalizeLockerCode(locker)} type="submit">Zapisz Paczkomat zwrotu</button>
            </form>
          )}
          {info.returnLocker?.code && <p className="muted">Paczkomat zwrotu: <strong>{info.returnLocker.code}</strong>{info.returnLocker.name ? ` · ${info.returnLocker.name}` : ''}</p>}
          {(sellerCanConfirm(info, role) || sellerCanDispute(info, role)) && panel !== 'dispute' && (
            <div className="order-actions" data-testid="return-seller-actions">
              {sellerCanConfirm(info, role) && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => confirmReturnReceived(orderId), 'Odbiór zwrotu potwierdzony. Kupujący dostanie zwrot ceny przedmiotu.')}>Potwierdzam odbiór zwrotu</button>}
              {sellerCanDispute(info, role) && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setPanel('dispute')}>Zgłoś problem ze zwrotem</button>}
            </div>
          )}
          {panel === 'dispute' && (
            <form onSubmit={(e) => { e.preventDefault(); void run(() => disputeReturn(orderId, text.trim()), 'Problem zgłoszony — sprawdzi go Bidigo.') }}>
              <label>
                <span className="label-text">Co jest nie tak ze zwrotem? (min. 10 znaków)</span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} required />
              </label>
              <div className="order-actions">
                <button className="btn btn-primary" disabled={busy || text.trim().length < 10} type="submit">Wyślij zgłoszenie</button>
                <button className="btn btn-outline" type="button" onClick={() => setPanel(null)}>Anuluj</button>
              </div>
            </form>
          )}
        </>
      )}
      {has && info?.status === 'rejected' && <p className="hint">Zwrot został odrzucony przez Bidigo{info.rejectReason ? `: ${info.rejectReason}` : ''}.</p>}
    </section>
  )
}
