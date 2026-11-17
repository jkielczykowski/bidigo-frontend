import { useEffect, useRef, useState } from 'react'
import { pointFromGeowidget, type LockerPoint } from '../lib/shipping'

// InPost Geowidget v5 (config=parcelCollect). The token is InPost's PUBLIC map token, meant for browsers.
const HOSTS: Record<string, string> = {
  production: 'https://geowidget.inpost.pl',
  sandbox: 'https://sandbox-easy-geowidget-sdk.easypack24.net',
}
const loaded: Record<string, Promise<void> | undefined> = {}

function loadAssets(host: string): Promise<void> {
  const existing = loaded[host]
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `${host}/inpost-geowidget.css`
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = `${host}/inpost-geowidget.js`
    js.defer = true
    js.onload = () => resolve()
    js.onerror = () => {
      loaded[host] = undefined
      reject(new Error('Nie udało się wczytać mapy Paczkomatów InPost.'))
    }
    document.head.appendChild(js)
  })
  loaded[host] = promise
  return promise
}

let seq = 0

type Props = {
  token?: string
  environment: string
  value: LockerPoint | null
  onChange: (p: LockerPoint) => void
}

/** Map of parcel lockers in a full-screen sheet; the selected locker is shown under the button. */
export function LockerPicker({ token, environment, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const mapRef = useRef<HTMLDivElement>(null)
  const cb = useRef(`bidigoLockerSelect_${++seq}`)

  useEffect(() => {
    if (!open) return
    const name = cb.current
    let cancelled = false
    ;(async () => {
      try {
        if (!token) throw new Error('Mapa Paczkomatów nie jest jeszcze skonfigurowana. Wpisz kod Paczkomatu ręcznie.')
        await loadAssets(HOSTS[environment] ?? HOSTS.production)
        if (cancelled || !mapRef.current) return
        ;(window as any)[name] = (p: Record<string, any>) => {
          onChange(pointFromGeowidget(p))
          setOpen(false)
        }
        const w = document.createElement('inpost-geowidget')
        w.setAttribute('token', token)
        w.setAttribute('language', 'pl')
        w.setAttribute('config', 'parcelCollect')
        w.setAttribute('onpoint', name)
        w.style.cssText = 'display:block;width:100%;height:100%'
        mapRef.current.replaceChildren(w)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Błąd mapy')
        setOpen(false)
      }
    })()
    return () => {
      cancelled = true
      delete (window as any)[name]
    }
  }, [open, token, environment, onChange])

  return (
    <div className="locker-picker">
      <button type="button" className="btn btn-outline" onClick={() => { setError(''); setOpen(true) }}>
        {value ? 'Zmień Paczkomat' : 'Wybierz Paczkomat na mapie'}
      </button>
      {value && (
        <p className="locker-selected">
          <strong>{value.code}</strong>
          {[value.address, [value.postCode, value.city].filter(Boolean).join(' ')].filter(Boolean).length > 0 &&
            ` — ${[value.address, [value.postCode, value.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}`}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {open && (
        <div className="locker-overlay" role="dialog" aria-modal="true" aria-label="Wybierz Paczkomat">
          <div className="locker-sheet">
            <div className="locker-sheet-top">
              <strong>Wybierz Paczkomat</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Zamknij</button>
            </div>
            <div ref={mapRef} className="locker-map" />
          </div>
        </div>
      )}
    </div>
  )
}
