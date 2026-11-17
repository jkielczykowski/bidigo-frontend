import '../orders.css'

/** Draft only — not a legal document. Needs a lawyer's review before publication (docs/orders-buyer-protection/LEGAL_REVIEW.md). */
export function ProtectionTermsPage() {
  return (
    <div className="container page">
      <h1>Ochrona Kupującego Bidigo — zasady (szkic)</h1>
      <p className="draft-banner">SZKIC — wymaga weryfikacji prawnej. Nie jest to obowiązujący regulamin.</p>
      <h3>Czym jest Ochrona Kupującego</h3>
      <p>
        To opcjonalna, płatna usługa dla kupujących przedmioty wysyłane Paczkomatem InPost. Kupujący płaci w Bidigo cenę przedmiotu,
        koszt dostawy i opłatę za ochronę. Sprzedający nie płaci żadnej prowizji.
      </p>
      <h3>Kiedy przysługuje</h3>
      <p>
        Gdy sprzedający zadeklarował wysyłkę Paczkomatem InPost, paczka mieści się w limitach przewoźnika, a usługa jest dostępna
        dla danej kategorii. Dla pozostałych przedmiotów transakcja odbywa się bezpośrednio między stronami (odbiór osobisty, czat).
      </p>
      <h3>Zgłoszenie problemu</h3>
      <p>
        Kupujący może zgłosić, że paczka nie dotarła, jest uszkodzona lub niezgodna z opisem — w terminie podanym w zamówieniu
        po doręczeniu. Zgłoszenie rozpatruje Bidigo; zwrot obejmuje kwotę ustaloną w rozstrzygnięciu.
      </p>
      <h3>Zwroty i anulowanie</h3>
      <p>Anulowanie opłaconego zamówienia przed nadaniem paczki skutkuje zwrotem płatności w całości na pierwotny sposób płatności.</p>
      <p className="muted">Zakres odpowiedzialności, prawo odstąpienia od umowy, sprzedawcy prywatni i przedsiębiorcy, RODO i płatności — do uzupełnienia po konsultacji prawnej.</p>
    </div>
  )
}
