import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isValidPlPhone, normalizePlPhone } from '../lib/phone'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

function displayPhone(phone: string | null | undefined) {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('48') && d.length === 11) return d.slice(2)
  return phone
}

export function VerifyPhonePage() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/my'
  // Changing a confirmed number: the server allows it once every 30 days (V50)
  const changing = params.get('change') === '1'

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [normalized, setNormalized] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [loading, user, navigate])

  useEffect(() => {
    if (profile?.phone_verified_at && !changing) {
      navigate(next, { replace: true })
      return
    }
    if (profile?.phone && !changing) setPhone(displayPhone(profile.phone))
  }, [profile, navigate, next, changing])

  async function sendCode() {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const n = normalizePlPhone(phone)
      if (!n || !isValidPlPhone(phone)) {
        throw new Error('Podaj prawidłowy numer telefonu (9 cyfr)')
      }
      const { data, error: rpcError } = await supabase.rpc('request_phone_otp', { p_phone: n })
      if (rpcError) throw rpcError
      const payload = data as { phone?: string }
      setNormalized(payload.phone ?? n)
      setInfo('Wysłaliśmy kod SMS. Wpisz go poniżej.')
      setStep('code')
      setResendIn(30)
      const timer = window.setInterval(() => {
        setResendIn((s) => {
          if (s <= 1) {
            window.clearInterval(timer)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } catch (err) {
      setError(errorMessage(err, 'Nie udało się wysłać kodu'))
    } finally {
      setBusy(false)
    }
  }

  async function onPhone(e: FormEvent) {
    e.preventDefault()
    await sendCode()
  }

  async function onCode(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const p = normalized ?? normalizePlPhone(phone)
      if (!p) throw new Error('Brak numeru telefonu')
      const clean = code.replace(/\D/g, '')
      if (clean.length !== 6) throw new Error('Podaj 6-cyfrowy kod z SMS')

      const { data, error: rpcError } = await supabase.rpc('confirm_phone_otp', {
        p_phone: p,
        p_code: clean,
      })
      if (rpcError) throw rpcError
      const payload = data as { verification_id?: string; error?: string; attempts_left?: number }
      if (!payload.verification_id) {
        const left = payload.attempts_left != null ? ` (pozostało prób: ${payload.attempts_left})` : ''
        throw new Error((payload.error || 'Weryfikacja nieudana') + left)
      }

      const { error: claimError } = await supabase.rpc('claim_phone_verification', {
        p_verification_id: payload.verification_id,
        p_phone: p,
      })
      if (claimError) throw claimError

      await refreshProfile()
      navigate(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Nie udało się potwierdzić numeru'))
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="container narrow page">
      <h1>{changing ? 'Zmień numer telefonu' : 'Potwierdź telefon'}</h1>
      <p className="muted">
        {changing
          ? `Wyślemy kod SMS na nowy numer. Obecny (${displayPhone(profile?.phone)}) zostaje, dopóki nie potwierdzisz nowego. Numer można zmienić raz na 30 dni.`
          : 'Kod SMS jest wymagany przy licytacji i wystawianiu aukcji. Numer podany przy rejestracji możesz zmienić poniżej.'}
      </p>

      {step === 'phone' && (
        <form className="card-form" onSubmit={(e) => void onPhone(e)} noValidate>
          <label>
            <span className="label-text">
              Numer telefonu<span className="req"> *</span>
            </span>
            <div className="phone-input-row">
              <span className="phone-prefix">+48</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                placeholder="512 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? 'Wysyłanie…' : 'Wyślij kod SMS'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form className="card-form" onSubmit={(e) => void onCode(e)} noValidate>
          <p className="hint">
            Kod wysłany na <strong>{normalized ?? phone}</strong>
          </p>
          <label>
            <span className="label-text">
              Kod z SMS<span className="req"> *</span>
            </span>
            <input
              className="otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
          {error && <p className="error">{error}</p>}
          {info && <p className="success">{info}</p>}
          <div className="form-actions-row">
            <button className="btn btn-ghost" type="button" onClick={() => setStep('phone')}>
              Zmień numer
            </button>
            <button className="btn btn-primary" disabled={busy || code.length !== 6} type="submit">
              {busy ? 'Weryfikacja…' : 'Potwierdź numer'}
            </button>
          </div>
          <button
            className="btn-link"
            type="button"
            disabled={busy || resendIn > 0}
            onClick={() => void sendCode()}
          >
            {resendIn > 0 ? `Wyślij ponownie (${resendIn}s)` : 'Wyślij kod ponownie'}
          </button>
        </form>
      )}

      <p className="muted" style={{ marginTop: '1.25rem' }}>
        <Link to={next}>Anuluj</Link>
      </p>
    </div>
  )
}
