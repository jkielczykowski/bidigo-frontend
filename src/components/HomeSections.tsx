import { Link } from 'react-router-dom'
import type { Category } from '../lib/database.types'

/** The main categories as tiles with their icons (the quiet text lists stay below, like on ricardo.ch). */
export function CategoryTiles({ categories }: { categories: Category[] }) {
  const tops = categories.filter((c) => !c.parent_id)
  if (tops.length === 0) return null
  return (
    <section className="bg-section home-cats" aria-labelledby="home-cats-h">
      <div className="container">
        <h2 id="home-cats-h">Przeglądaj według kategorii</h2>
        <ul className="home-cat-grid">
          {tops.map((c) => (
            <li key={c.id}>
              <Link to={`/auctions?cat=${encodeURIComponent(c.id)}`} className="home-cat">
                <span className="home-cat-ic" aria-hidden>
                  {c.icon ?? '•'}
                </span>
                <span className="home-cat-name">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const TRUST: { icon: string; title: string; body: string }[] = [
  { icon: '📱', title: 'Zweryfikowani użytkownicy', body: 'Licytować i wystawiać można po potwierdzeniu numeru kodem SMS.' },
  { icon: '🛡️', title: 'Sprawdzane ogłoszenia', body: 'Treść i zdjęcia przechodzą moderację, zanim aukcja trafi na listę.' },
  { icon: '🤖', title: 'Licytacja z limitem', body: 'Ustawiasz maksimum, a Bidigo podbija za Ciebie tylko o tyle, ile trzeba.' },
  { icon: '🔔', title: 'Powiadomienia', body: 'Dostajesz znać, gdy ktoś Cię przebije albo pojawi się aukcja z Twojej frazy.' },
]

export function TrustStrip() {
  return (
    <section className="bg-section home-trust" aria-label="Dlaczego Bidigo">
      <div className="container">
        <ul className="home-trust-grid">
          {TRUST.map((t) => (
            <li key={t.title}>
              <span className="home-trust-ic" aria-hidden>
                {t.icon}
              </span>
              <div>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const STEPS = ['Dodaj zdjęcia i opis', 'Ustaw cenę i czas trwania aukcji', 'Gdy ktoś wygra, umówcie się na odbiór lub wysyłkę']

export function SellBanner() {
  return (
    <section className="home-sell" aria-labelledby="home-sell-h">
      <div className="container home-sell-inner">
        <div>
          <h2 id="home-sell-h">Sprzedaj w 2 minuty</h2>
          <p>Masz coś, czego już nie używasz? Wystaw to na Bidigo: licytacja albo „Kup teraz”, jasna prowizja od sprzedaży.</p>
          <ol className="home-sell-steps">
            {STEPS.map((s, i) => (
              <li key={s}>
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <Link className="btn btn-primary" to="/sell">
            Wystaw przedmiot
          </Link>
        </div>
      </div>
    </section>
  )
}
