const STEPS = [
  { icon: '🔍', title: 'Znajdź przedmiot', body: 'Szukaj po nazwie, kategorii albo w swojej okolicy.' },
  { icon: '🎯', title: 'Ustaw swój limit', body: 'Wpisz maksymalną kwotę, jaką chcesz zapłacić. Nikt jej nie widzi.' },
  { icon: '🤖', title: 'Bidigo licytuje za Ciebie', body: 'Gdy ktoś Cię przebije, podbijamy tylko o tyle, ile trzeba.' },
  { icon: '🏆', title: 'Wygrywasz', body: 'Płacisz cenę wygranej oferty, a nie cały limit.' },
]

const EXAMPLE = [
  { who: 'Anna', text: 'licytuje', amount: '190 zł', tone: 'other' },
  { who: 'Ty', text: 'ustawiasz limit', amount: '250 zł', tone: 'you' },
  { who: 'Anna', text: 'podbija do', amount: '220 zł', tone: 'other' },
  { who: 'Bidigo', text: 'podbija za Ciebie', amount: '230 zł', tone: 'you' },
]

/** "Tak działa licytacja": cztery czytelne kroki i jeden przykład liczbowy, bez animowanej karty. */
export function BidDemo() {
  return (
    <section className="hiw2" id="jak-dziala" aria-labelledby="hiw2-h">
      <div className="container">
        <p className="hiw2-tag">Jak to działa</p>
        <h2 id="hiw2-h">Tak działa licytacja</h2>
        <p className="hiw2-lead">Cztery kroki. Ustawiasz limit raz, resztą zajmuje się Bidigo.</p>

        <ol className="hiw2-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="hiw2-step">
              <span className="hiw2-num">{i + 1}</span>
              <span className="hiw2-ic" aria-hidden>{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="hiw2-example">
          <h3>Przykład: aparat analogowy</h3>
          <ul>
            {EXAMPLE.map((e, i) => (
              <li key={i} className={`is-${e.tone}`}>
                <span className="hiw2-who">{e.who}</span>
                <span className="hiw2-what">{e.text}</span>
                <b>{e.amount}</b>
              </li>
            ))}
          </ul>
          <p className="hiw2-win">🏆 Wygrywasz za <b>230 zł</b>, a nie za cały limit 250 zł.</p>
        </div>
      </div>
    </section>
  )
}
