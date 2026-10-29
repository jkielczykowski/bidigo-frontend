import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { RESEND_COOLDOWN_S, knownAuthError } from '../lib/authFlow'

/** "Wyślij ponownie" for the confirmation e-mail — at most once per RESEND_COOLDOWN_S */
export function ResendConfirmation({ email, startCooling = false }: { email: string; startCooling?: boolean }) {
  const { resendConfirmation } = useAuth()
  const [left, setLeft] = useState(startCooling ? RESEND_COOLDOWN_S : 0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  async function resend() {
    setBusy(true)
    setStatus(null)
    try {
      await resendConfirmation(email)
      setStatus({ kind: 'ok', text: 'Wysłaliśmy wiadomość ponownie. Sprawdź też folder ze spamem.' })
    } catch (err) {
      setStatus({
        kind: 'error',
        text: knownAuthError(err) ?? 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.',
      })
    } finally {
      setBusy(false)
      setLeft(RESEND_COOLDOWN_S)
    }
  }

  return (
    <div className="resend-confirmation">
      <button className="btn btn-outline" type="button" disabled={busy || left > 0} onClick={() => void resend()}>
        {busy ? 'Wysyłanie…' : left > 0 ? `Wyślij ponownie (${left} s)` : 'Wyślij ponownie'}
      </button>
      <p
        className={status?.kind === 'error' ? 'error' : 'success'}
        role={status?.kind === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {status?.text}
      </p>
    </div>
  )
}
