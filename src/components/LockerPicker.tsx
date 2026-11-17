import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { judgePoint, normaliseLocker, pointAddressLine, pointFromCode, type LockerPoint } from '../lib/shippingModel'

/** Pause before the map is reloaded after it did not report in (1 s, 2 s, 4 s), then the code can be typed instead. */
export const MAP_RETRY_MS = [1000, 2000, 4000]
const READY_TIMEOUT_MS = 12000

type Props = {
  /** InPost's PUBLIC map token (not a secret); empty = no map, the code is typed. */
  token?: string
  environment: string
  value: LockerPoint | null
  onChange: (p: LockerPoint | null) => void
  /** A code already saved for this order: shown as the chosen locker until the buyer changes it. */
  initialCode?: string | null
  /** Show the "choose a locker" message (the form was submitted without one). */
  showError?: boolean
}

type MapState = 'loading' | 'ready' | 'failed'

/**
 * Parcel locker choice, the same way as in FluffyTag's checkout: the InPost map is shown right in the page (lockers only,
 * a place search above it, the point's own card with address and hours and its "Wybierz" button); after a choice the map
 * gives way to a card with the locker and "Zmień Paczkomat"; when the map cannot load (1 s / 2 s / 4 s retries) the buyer
 * types the code, which is checked the same way. The map lives in /locker-frame/ (own page in an iframe: no style clashes).
 */
export function LockerPicker({ token, environment, value, onChange, initialCode, showError }: Props) {
  const id = `bl${useId().replace(/[^a-z0-9]/gi, '')}`
  const [map, setMap] = useState<MapState>(token ? 'loading' : 'failed')
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const [manual, setManual] = useState(initialCode ?? '')
  const [touched, setTouched] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // a code saved with the order counts as chosen until changed
  useEffect(() => {
    if (!value && initialCode) onChangeRef.current(pointFromCode(initialCode))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode])

  useEffect(() => {
    if (!token) return
    const onMessage = (ev: MessageEvent) => {
      const d = ev.data as { bidigoLocker?: boolean; id?: string; event?: string; point?: Record<string, unknown>; reason?: string } | null
      if (!d?.bidigoLocker || d.id !== id || ev.origin !== window.location.origin || ev.source !== frameRef.current?.contentWindow) return
      if (d.event === 'ready') setMap('ready')
      else if (d.event === 'point') {
        const j = judgePoint(d.point)
        if (j.ok) {
          setNotice('')
          onChangeRef.current(j.point)
        } else setNotice(j.reason === 'not_locker' ? 'To PaczkoPunkt. Wybierz Paczkomat (skrytkę 24/7).' : 'Nie rozpoznaję tego punktu. Wybierz inny Paczkomat.')
      } else if (d.event === 'error') {
        if (d.reason === 'not_locker') setNotice('To PaczkoPunkt. Wybierz Paczkomat (skrytkę 24/7).')
        else setMap('failed')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [token, id])

  // the map must report in; if not, try again (reload the frame) and finally give up for the typed code
  useEffect(() => {
    if (!token || map !== 'loading') return
    const t = setTimeout(() => {
      if (attempt >= MAP_RETRY_MS.length) setMap('failed')
      else setTimeout(() => setAttempt((a) => a + 1), MAP_RETRY_MS[attempt])
    }, READY_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [token, map, attempt])

  const retry = useCallback(() => {
    setNotice('')
    setAttempt((a) => a + 1)
    setMap(token ? 'loading' : 'failed')
  }, [token])

  const src = `/locker-frame/index.html?${new URLSearchParams({ token: token ?? '', env: environment, id, lang: 'pl', a: String(attempt) })}`

  function typed(raw: string) {
    setManual(raw)
    onChange(pointFromCode(raw))
  }

  if (value) {
    const line = pointAddressLine(value)
    return (
      <div className="locker-picker">
        <div className="locker-chosen" role="status" data-testid="locker-selected">
          <p className="locker-chosen-title">✓ Wybrany Paczkomat: <strong>{value.code}</strong></p>
          {value.name && value.name !== value.code && <p>{value.name}</p>}
          {line && <p className="muted">{line}</p>}
          {value.hours && <p className="muted">Godziny: {value.hours}</p>}
          <button type="button" className="btn btn-outline btn-sm" data-testid="locker-change" onClick={() => { onChange(null); setManual(''); setTouched(false); setNotice(''); if (map === 'ready') setMap('loading'); setAttempt((a) => a + 1) }}>
            Zmień Paczkomat
          </button>
        </div>
      </div>
    )
  }

  const manualError = touched && !normaliseLocker(manual) ? (manual.trim() ? 'Nieprawidłowy kod Paczkomatu (format np. KRA010M).' : 'Wybierz Paczkomat na mapie lub wpisz jego kod.') : ''
  return (
    <div className="locker-picker" data-testid="locker-section">
      {map !== 'failed' && token ? (
        <>
          <p className="locker-hint">Wybierz Paczkomat na mapie: wpisz miejscowość, dotknij punktu i kliknij „Wybierz”.</p>
          <div className="locker-frame-wrap">
            {map === 'loading' && <p className="locker-loading muted" role="status">Ładowanie mapy…</p>}
            <iframe key={attempt} ref={frameRef} className="locker-frame" title="Mapa Paczkomatów InPost" src={src} />
          </div>
        </>
      ) : (
        <div data-testid="locker-manual">
          <label className="locker-manual-label">
            Kod Paczkomatu
            <input value={manual} onChange={(e) => typed(e.target.value)} onBlur={() => setTouched(true)} maxLength={20} placeholder="np. KRA010M" autoComplete="off" autoCapitalize="characters"
              aria-invalid={!!manualError} aria-describedby="locker-manual-help" className="locker-manual-input" />
          </label>
          <p id="locker-manual-help" className={manualError ? 'error' : 'hint'} role={manualError ? 'alert' : undefined}>
            {manualError || (token ? 'Mapa Paczkomatów jest chwilowo niedostępna: wpisz kod ze strony inpost.pl.' : 'Wpisz kod Paczkomatu ze strony inpost.pl.')}
          </p>
          {token && <button type="button" className="btn btn-outline btn-sm" data-testid="map-retry" onClick={retry}>Spróbuj ponownie załadować mapę</button>}
        </div>
      )}
      {notice && <p className="error" role="alert">{notice}</p>}
      {showError && !notice && map !== 'failed' && <p className="error" role="alert">Wybierz Paczkomat na mapie.</p>}
    </div>
  )
}
