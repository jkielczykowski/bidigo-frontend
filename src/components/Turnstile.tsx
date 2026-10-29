import { useEffect, useRef } from 'react'

/** Cloudflare Turnstile site key; empty = sign-up has no captcha */
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  const w = window as unknown as { turnstile?: TurnstileApi }
  if (w.turnstile) return Promise.resolve(w.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error('Turnstile')))
    script.onerror = () => {
      loading = null
      reject(new Error('Turnstile'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** The captcha widget: onToken(token) when solved, onToken(null) when the token expires or fails */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let widget: string | null = null
    let cancelled = false
    void loadTurnstile()
      .then((api) => {
        if (cancelled || !box.current) return
        widget = api.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: 'pl',
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => onToken(null))
    return () => {
      cancelled = true
      if (widget) (window as unknown as { turnstile?: TurnstileApi }).turnstile?.remove(widget)
    }
  }, [onToken])

  return <div ref={box} aria-label="Weryfikacja antyrobotowa" />
}
