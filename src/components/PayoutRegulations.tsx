import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Widżet akceptacji regulaminu operatora płatności. Skrypt SDK pochodzi z adresu widgetUrl zwróconego przez nasze API
// (tylko https), a samo „Akceptuję” robi acceptRegulations() widżetu; my dowiadujemy się o tym ze zdarzenia 'accept'.

type RegForm = {
  on: (ev: string, cb: (arg?: unknown) => void) => void
  render: (selector: string, opts: Record<string, string>) => void
  acceptRegulations: () => void
}
declare global {
  interface Window { PayuRegulationsForm?: (opts: { shopId: string; extCustomerId: string; dev?: boolean }) => RegForm }
}

export type PayoutRegulationsHandle = { accept: () => void }

const loading = new Map<string, Promise<void>>()
function loadSdk(url: string): Promise<void> {
  if (!/^https:\/\//i.test(url)) return Promise.reject(new Error('Nieprawidłowy adres widżetu'))
  let p = loading.get(url)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = url
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { loading.delete(url); s.remove(); reject(new Error('Nie udało się wczytać okna akceptacji regulaminu')) }
      document.head.appendChild(s)
    })
    loading.set(url, p)
  }
  return p
}

export const PayoutRegulations = forwardRef<PayoutRegulationsHandle, {
  widgetUrl: string
  shopId: string
  extCustomerId: string
  onAccepted: () => void
  onState?: (s: 'loading' | 'ready' | 'error') => void
}>(function PayoutRegulations({ widgetUrl, shopId, extCustomerId, onAccepted, onState }, ref) {
  const form = useRef<RegForm | null>(null)
  const cb = useRef({ onAccepted, onState })
  cb.current = { onAccepted, onState }
  const [error, setError] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({ accept: () => form.current?.acceptRegulations() }))

  useEffect(() => {
    let dead = false
    cb.current.onState?.('loading')
    loadSdk(widgetUrl)
      .then(() => {
        if (dead) return
        const ctor = window.PayuRegulationsForm
        if (!ctor) throw new Error('Okno akceptacji regulaminu jest niedostępne')
        // sandbox operatora (adres z „snd”) wymaga trybu dev widżetu
        const f = ctor({ shopId, extCustomerId, dev: /\.snd\./.test(widgetUrl) })
        f.on('ready', () => !dead && cb.current.onState?.('ready'))
        f.on('accept', () => !dead && cb.current.onAccepted())
        f.on('error', () => !dead && setError('Nie udało się zapisać akceptacji regulaminu. Spróbuj ponownie.'))
        f.render('#payoutRegulations', { label: 'Akceptuję regulamin (', linkLabel: 'otwórz', labelAfterLink: ')' })
        form.current = f
      })
      .catch((e: unknown) => {
        if (dead) return
        setError(e instanceof Error ? e.message : 'Nie udało się wczytać okna akceptacji regulaminu')
        cb.current.onState?.('error')
      })
    return () => { dead = true; form.current = null }
  }, [widgetUrl, shopId, extCustomerId])

  return (
    <>
      <div id="payoutRegulations" data-testid="payout-regulations" />
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
})
