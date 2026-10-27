import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'

const REASONS: { id: string; label: string }[] = [
  { id: 'prohibited', label: 'Towar zakazany (broń, narkotyki, podróbki…)' },
  { id: 'offensive', label: 'Treści obraźliwe lub wulgarne' },
  { id: 'adult', label: 'Treści dla dorosłych' },
  { id: 'scam', label: 'Oszustwo' },
  { id: 'spam', label: 'Spam lub duplikat' },
  { id: 'wrong_category', label: 'Zła kategoria' },
  { id: 'other', label: 'Inny powód' },
]

/** "Zgłoś ogłoszenie": report_auction (bidigo-backend V44); 3 reports from different users hide the listing. */
export function ReportAuction({ auctionId, userId }: { auctionId: string; userId: string | null }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reported, setReported] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void supabase
      .from('auction_reports')
      .select('id')
      .eq('auction_id', auctionId)
      .eq('reporter_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setReported(!!data)
      })
    return () => {
      cancelled = true
    }
  }, [auctionId, userId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!reason) {
      setError('Wybierz powód zgłoszenia.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('report_auction', {
      p_auction_id: auctionId,
      p_reason: reason,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (err) {
      setError(errorMessage(err, 'Nie udało się wysłać zgłoszenia'))
      return
    }
    setReported(true)
  }

  if (reported && !open) {
    return <p className="report-done muted">Zgłosiłeś to ogłoszenie — dziękujemy, sprawdzimy je.</p>
  }

  return (
    <>
      <button type="button" className="btn-link report-link" onClick={() => setOpen(true)}>
        Zgłoś ogłoszenie
      </button>
      <Modal open={open} title="Zgłoś ogłoszenie" onClose={() => !busy && setOpen(false)}>
        {!userId ? (
          <p>
            <Link to="/login">Zaloguj się</Link>, aby zgłosić ogłoszenie.
          </p>
        ) : reported ? (
          <div className="report-modal">
            <p>Dziękujemy — zgłoszenie trafiło do moderatorów.</p>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
              Zamknij
            </button>
          </div>
        ) : (
          <form className="report-modal" onSubmit={(e) => void submit(e)}>
            <fieldset>
              <legend>Co jest nie tak?</legend>
              {REASONS.map((r) => (
                <label key={r.id} className="report-reason">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label>
              Szczegóły (opcjonalnie)
              <textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
            </button>
          </form>
        )}
      </Modal>
    </>
  )
}
