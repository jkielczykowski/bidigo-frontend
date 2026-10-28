import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CitySuggest } from '../components/CitySuggest'
import { useAuth } from '../lib/auth'
import { normalizePlPhone } from '../lib/phone'
import { supabase } from '../lib/supabase'

/** A confirmed number can be changed once every 30 days, by an SMS code to the new number (V50) */
const PHONE_CHANGE_DAYS = 30

export function ProfileSettingsPage() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const phoneVerified = Boolean(profile?.phone_verified_at)
  const phoneChangeFrom = profile?.phone_verified_at
    ? new Date(new Date(profile.phone_verified_at).getTime() + PHONE_CHANGE_DAYS * 86_400_000)
    : null

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [loading, user, navigate])

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name || '')
    setPhone(profile.phone || '')
    setCity(profile.city || '')
    setBio(profile.bio || '')
  }, [profile])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      if (!displayName.trim() || displayName.trim().length < 2) {
        throw new Error('Nick min. 2 znaki')
      }
      const normalizedPhone = phoneVerified ? (profile?.phone ?? null) : normalizePlPhone(phone)
      if (!normalizedPhone) {
        throw new Error('Podaj prawidłowy numer telefonu (9 cyfr)')
      }
      if (city.trim() && city.trim().length < 2) {
        throw new Error('Podaj poprawne miasto albo zostaw puste')
      }

      const phoneChanged = normalizedPhone !== (profile?.phone || null)
      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: displayName.trim().toLowerCase().replace(/\s+/g, ''),
          // A confirmed number is changed only through /verify-phone?change=1
          ...(phoneVerified ? {} : { phone: normalizedPhone }),
          ...(phoneChanged && !phoneVerified ? { phone_verified_at: null } : {}),
          city: city.trim() || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updErr) {
        if (/profiles_phone_unique|duplicate key.*phone/i.test(updErr.message)) {
          throw new Error('Ten numer telefonu jest już zajęty')
        }
        throw updErr
      }

      await refreshProfile()
      setOk('Zapisano ustawienia')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="container narrow page">
      <h1>Ustawienia profilu</h1>
      <p className="muted">Nick, telefon, miasto — widać przy aukcjach i w czacie.</p>

      <form className="card-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label>
          <span className="label-text">Email</span>
          <input type="email" value={user.email ?? ''} disabled />
          <span className="field-hint">Email zmienia się w logowaniu — na razie tylko do odczytu.</span>
        </label>

        <label>
          <span className="label-text">
            Nick / imię<span className="req"> *</span>
          </span>
          <input
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nick"
          />
        </label>

        <label>
          <span className="label-text">
            Numer telefonu<span className="req"> *</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="512 345 678"
            disabled={phoneVerified}
          />
          {phoneVerified ? (
            <span className="field-hint">
              Numer potwierdzony SMS.{' '}
              {phoneChangeFrom && phoneChangeFrom > new Date() ? (
                <>Zmienisz go od {phoneChangeFrom.toLocaleDateString('pl-PL')} (raz na {PHONE_CHANGE_DAYS} dni).</>
              ) : (
                <Link to="/verify-phone?change=1&next=/settings">Zmień numer</Link>
              )}
            </span>
          ) : (
            <span className="field-hint">
              Numer niepotwierdzony —{' '}
              <Link to="/verify-phone?next=/settings">potwierdź kodem SMS</Link>, żeby licytować i wystawiać.
            </span>
          )}
        </label>

        <CitySuggest
          value={city}
          required={false}
          label="Miasto"
          onChange={setCity}
        />

        <label>
          <span className="label-text">O mnie</span>
          <textarea
            rows={4}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Np. sprzedaję z Warszawy, odbiór osobisty lub InPost."
          />
        </label>

        {error && <p className="error">{error}</p>}
        {ok && <p className="success">{ok}</p>}

        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: '1.25rem' }}>
        <Link to="/usun-konto">Usuń konto</Link>
        {' · '}
        <Link to="/my">Panel Moje</Link>
      </p>
    </div>
  )
}
