import { useEffect, useRef, useState } from 'react'

type Bid = { id: number; who: 'Anna' | 'Ty'; amount: number; auto?: boolean }

const START = 180
const LIMIT = 250

// One loop of the story: someone bids, you set a limit, Bidigo answers for you, you win paying only what was needed.
const STEPS: { at: number; caption: string; bid?: Omit<Bid, 'id'>; limit?: boolean; won?: boolean }[] = [
  { at: 0, caption: 'Ktoś składa ofertę' },
  { at: 1400, caption: 'Ty ustawiasz limit', limit: true },
  { at: 3000, caption: 'Ktoś Cię przebija', bid: { who: 'Anna', amount: 200 } },
  { at: 3900, caption: 'Bidigo podbija za Ciebie', bid: { who: 'Ty', amount: 210, auto: true } },
  { at: 5500, caption: 'Ktoś Cię przebija', bid: { who: 'Anna', amount: 220 } },
  { at: 6400, caption: 'Bidigo podbija za Ciebie', bid: { who: 'Ty', amount: 230, auto: true } },
  { at: 8200, caption: 'Wygrywasz za 230 zł, nie za cały limit', won: true },
]
const LOOP_MS = 12500

/** The only explainer on the landing: how bidding with a limit works, as a short looping story. */
export function BidDemo() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [bids, setBids] = useState<Bid[]>([{ id: 0, who: 'Anna', amount: 190 }])
  const [limit, setLimit] = useState(false)
  const [won, setWon] = useState(false)
  const [caption, setCaption] = useState(STEPS[0].caption)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const [round, setRound] = useState(0)
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Reduced motion: no loop, just the finished story
  useEffect(() => {
    if (!reduced) return
    setBids([
      { id: 1, who: 'Ty', amount: 230, auto: true },
      { id: 2, who: 'Anna', amount: 220 },
      { id: 3, who: 'Ty', amount: 210, auto: true },
      { id: 4, who: 'Anna', amount: 200 },
    ])
    setLimit(true)
    setWon(true)
    setCaption(STEPS[STEPS.length - 1].caption)
  }, [reduced])

  useEffect(() => {
    if (reduced || paused || !visible) return
    setBids([{ id: 0, who: 'Anna', amount: 190 }])
    setLimit(false)
    setWon(false)
    setCaption(STEPS[0].caption)
    const timers: number[] = []
    let n = 1
    for (const s of STEPS.slice(1)) {
      timers.push(
        window.setTimeout(() => {
          setCaption(s.caption)
          if (s.limit) setLimit(true)
          if (s.bid) setBids((prev) => [{ id: n++, ...s.bid! }, ...prev].slice(0, 4))
          if (s.won) setWon(true)
        }, s.at),
      )
    }
    timers.push(window.setTimeout(() => setRound((r) => r + 1), LOOP_MS))
    return () => timers.forEach(window.clearTimeout)
  }, [round, paused, visible, reduced])

  const price = bids[0]?.amount ?? START

  return (
    <section ref={rootRef} className="biddemo" id="jak-dziala" aria-labelledby="biddemo-h">
      <div className="container">
        <h2 id="biddemo-h">Tak działa licytacja</h2>
        <div className={`biddemo-card${won ? ' is-won' : ''}`} aria-hidden>
          <div className="biddemo-top">
            <span className="biddemo-thumb" />
            <div>
              <strong>Aparat analogowy</strong>
              <span>{won ? 'Zakończona' : 'Na żywo'}</span>
            </div>
          </div>
          <div className="biddemo-price" key={price}>
            {price} zł
          </div>
          <ul className="biddemo-bids">
            {bids.map((b) => (
              <li key={b.id} className={b.who === 'Ty' ? 'is-you' : ''}>
                <span>{b.who}</span>
                {b.auto && <em>automatycznie</em>}
                <b>{b.amount} zł</b>
              </li>
            ))}
          </ul>
          <div className={`biddemo-limit${limit ? ' is-on' : ''}`}>
            <span>Twój limit</span>
            <b>{LIMIT} zł</b>
          </div>
          {won && <div className="biddemo-win">Wygrywasz za {price} zł</div>}
        </div>
        <p className="biddemo-caption">{caption}</p>
        <p className="biddemo-sr">
          Przykład: ktoś licytuje 190 zł. Ustawiasz limit 250 zł. Gdy ktoś Cię przebija, Bidigo podbija za Ciebie tylko o tyle,
          ile trzeba. Wygrywasz za 230 zł, a nie za cały limit.
        </p>
        {!reduced && (
          <button type="button" className="biddemo-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? '▶ Wznów animację' : '⏸ Wstrzymaj animację'}
          </button>
        )}
      </div>
    </section>
  )
}
