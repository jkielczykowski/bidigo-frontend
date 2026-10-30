import { useEffect, useRef, useState } from 'react'

type Mode = 'buy' | 'sell'

const STEPS: Record<Mode, { title: string; text: string }[]> = {
  buy: [
    { title: 'Znajdź', text: 'Szukaj albo przeglądaj kategorie. Wybierz licytację lub „Kup teraz”.' },
    { title: 'Licytuj', text: 'Złóż ofertę i obserwuj licytację. Możesz też kupić bez czekania.' },
    { title: 'Dogadaj odbiór', text: 'Ustal ze sprzedającym dostawę lub odbiór osobisty.' },
  ],
  sell: [
    { title: 'Wystaw', text: 'Zrób zdjęcia, dodaj opis i wybierz kategorię.' },
    { title: 'Ustaw cenę', text: 'Licytacja, „Kup teraz” albo jedno i drugie. Cenę podbiją chętni.' },
    { title: 'Wyślij lub przekaż', text: 'Gdy aukcja się skończy, ustalasz odbiór z kupującym.' },
  ],
}

const STEP_MS = 5000

function Scene({ mode, step }: { mode: Mode; step: number }) {
  if (mode === 'buy' && step === 0)
    return (
      <>
        <div className="hiw-search hiw-a">
          🔍 <span className="hiw-type">aparat analogowy</span>
          <span className="hiw-caret" />
        </div>
        {[
          ['#ffd88a,#ff8551', 'Aparat analogowy', '240 zł · 12 ofert', 1.6],
          ['#cfdcff,#2b4a8a', 'Aparat, w pełni sprawny', 'Kup teraz · 310 zł', 1.9],
          ['#c8f0d4,#159947', 'Obiektyw 50 mm', '95 zł · 4 oferty', 2.2],
        ].map(([bg, t, s, d]) => (
          <div key={t as string} className="hiw-row hiw-a" style={{ ['--d' as string]: `${d}s` }}>
            <i style={{ background: `linear-gradient(135deg,${bg})` }} />
            <div>
              <b>{t}</b>
              <span>{s}</span>
            </div>
          </div>
        ))}
      </>
    )
  if (mode === 'buy' && step === 1)
    return (
      <>
        <div className="hiw-a">
          <b>Aparat analogowy</b>
          <div className="hiw-note">Kończy się za 02:14:55</div>
        </div>
        <div className="hiw-price" aria-hidden>
          <span>120 zł</span>
          <span>135 zł</span>
          <span>150 zł</span>
        </div>
        <div className="hiw-btn">Licytuj</div>
        <div className="hiw-win hiw-a" style={{ ['--d' as string]: '3.4s' }}>
          Prowadzisz z ofertą 150 zł
        </div>
      </>
    )
  if (mode === 'buy')
    return (
      <>
        <div className="hiw-bub l hiw-a">Cześć! Odbiór dziś wieczorem?</div>
        <div className="hiw-bub r hiw-a" style={{ ['--d' as string]: '.9s' }}>Jasne, 18:00 pod metrem</div>
        <div className="hiw-bub l hiw-a" style={{ ['--d' as string]: '1.8s' }}>Super, do zobaczenia 👍</div>
        <div className="hiw-win hiw-a" style={{ ['--d' as string]: '2.8s' }}>Przedmiot odebrany ✓</div>
      </>
    )
  if (step === 0)
    return (
      <>
        <div className="hiw-photo hiw-a">📷</div>
        <div className="hiw-search hiw-a" style={{ ['--d' as string]: '1.1s' }}>
          <span className="hiw-type" style={{ animationDelay: '1.3s' }}>Aparat analogowy</span>
        </div>
        <div className="hiw-chips hiw-a" style={{ ['--d' as string]: '2.4s' }}>
          <span>Foto i optyka</span>
          <span>Bardzo dobry stan</span>
          <span>Warszawa</span>
        </div>
      </>
    )
  if (step === 1)
    return (
      <>
        <div className="hiw-toggle hiw-a">
          <span className="on">Licytacja</span>
          <span>Kup teraz</span>
        </div>
        <div className="hiw-search hiw-a" style={{ ['--d' as string]: '.5s' }}>
          Cena startowa: <b>1 zł</b>
        </div>
        {[
          ['Oferta 1', '40 zł', 1.4],
          ['Oferta 2', '95 zł', 2.1],
          ['Oferta 3', '180 zł', 2.8],
        ].map(([a, b, d]) => (
          <div key={a as string} className="hiw-bid hiw-a" style={{ ['--d' as string]: `${d}s` }}>
            <span>{a}</span>
            <span>{b}</span>
          </div>
        ))}
      </>
    )
  return (
    <>
      <div className="hiw-pack">📦</div>
      <div className="hiw-sold hiw-a" style={{ ['--d' as string]: '1.6s' }}>Sprzedane za 180 zł 🎉</div>
      <div className="hiw-bub l hiw-a" style={{ ['--d' as string]: '2.4s' }}>Dzięki! Wysyłam dziś.</div>
    </>
  )
}

export function HowItWorks() {
  const [mode, setMode] = useState<Mode>('buy')
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (reduced || paused || !visible) return
    const t = setTimeout(() => setStep((s) => (s + 1) % 3), STEP_MS)
    return () => clearTimeout(t)
  }, [step, mode, paused, visible, reduced])

  const pick = (m: Mode) => {
    setMode(m)
    setStep(0)
  }

  return (
    <div ref={rootRef} className={`hiw${paused ? ' is-paused' : ''}`}>
      <div
        className="hiw-seg"
        role="tablist"
        aria-label="Wybierz rolę"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            pick(mode === 'buy' ? 'sell' : 'buy')
          }
        }}
      >
        {(['buy', 'sell'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => pick(m)}
          >
            {m === 'buy' ? 'Kupuję' : 'Sprzedaję'}
          </button>
        ))}
      </div>
      <div className="hiw-grid">
        <div>
          <ol className="hiw-steps">
            {STEPS[mode].map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  className="hiw-step"
                  aria-current={i === step ? 'step' : undefined}
                  style={{ ['--dur' as string]: `${STEP_MS}ms` }}
                  onClick={() => setStep(i)}
                >
                  <span className="hiw-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <span className="hiw-pbar" />
                </button>
              </li>
            ))}
          </ol>
          {!reduced && (
            <button type="button" className="hiw-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? '▶ Wznów animację' : '⏸ Wstrzymaj animację'}
            </button>
          )}
        </div>
        <div className="hiw-stage" aria-hidden>
          <div className="hiw-phone">
            <Scene key={`${mode}-${step}`} mode={mode} step={step} />
          </div>
        </div>
      </div>
    </div>
  )
}
