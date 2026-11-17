import { Link } from 'react-router-dom'

/** Zasady Ochrony Kupującego — opis działania usługi; spójny z Regulaminem (punkt 6). */
export function ProtectionTermsPage() {
  return (
    <div className="container narrow page legal-page">
      <header className="legal-hero">
        <p className="section-tag">Dokumenty</p>
        <h1>Ochrona Kupującego Bidigo</h1>
        <p className="muted">Ostatnia aktualizacja: 17 listopada 2026</p>
      </header>
      <div className="legal-body">
        <p>
          Ochrona Kupującego to opcjonalna, płatna usługa dla kupujących przedmioty wysyłane Paczkomatem InPost. Sprzedający
          nie płaci za nią nic. Jest częścią <Link to="/terms">Regulaminu</Link> (punkt 6).
        </p>

        <h2>Kiedy możesz z niej skorzystać</h2>
        <ul>
          <li>Sprzedający zadeklarował wysyłkę Paczkomatem InPost i podał wymiary, wagę oraz koszt wysyłki.</li>
          <li>Paczka mieści się w limitach przewoźnika.</li>
          <li>Usługa jest dostępna dla kategorii i ceny przedmiotu.</li>
        </ul>
        <p>
          Gdy przedmiot się nie kwalifikuje, na stronie aukcji zobaczysz informację o tym. Taką transakcję zawierasz
          bezpośrednio ze sprzedającym (odbiór osobisty lub wysyłka ustalona na czacie) — wtedy Bidigo nie obsługuje płatności.
        </p>

        <h2>Ile to kosztuje</h2>
        <p>
          Przed płatnością widzisz pełne podsumowanie: cenę przedmiotu, koszt dostawy Paczkomatem i opłatę za ochronę, oraz
          kwotę łączną. Opłata nie jest ukrywana ani doliczana później. Jej wysokość ustala Bidigo i może zależeć od kategorii
          lub podlegać promocji. Jeśli koszt zmieni się, zanim zapłacisz, poprosimy o ponowne potwierdzenie nowej kwoty.
        </p>

        <h2>Jak to działa</h2>
        <ol>
          <li>Kupujesz przedmiot („Kup teraz” albo wygrywasz aukcję). Powstaje zamówienie.</li>
          <li>Wybierasz: zapłata w Bidigo z Ochroną albo transakcja bezpośrednia. Masz na to czas podany w zamówieniu — potem zamówienie staje się transakcją bezpośrednią.</li>
          <li>Po opłaceniu sprzedający nadaje paczkę w Paczkomacie.</li>
          <li>Po doręczeniu potwierdzasz odbiór. Jeśli coś jest nie tak, w terminie podanym w zamówieniu zgłaszasz problem.</li>
          <li>Gdy nie zgłosisz problemu do końca terminu, zamówienie kończy się samo.</li>
        </ol>

        <h2>Anulowanie i zwroty</h2>
        <ul>
          <li>Zamówienie możesz anulować do czasu nadania paczki. Opłacone zamówienie jest wtedy zwracane w całości, razem z opłatą za ochronę.</li>
          <li>Jeśli paczka nie dotarła, jest uszkodzona albo niezgodna z opisem, zgłoś problem w zamówieniu. Wysłuchamy obu stron i podejmiemy decyzję: zwrot pełny, częściowy albo jego brak.</li>
          <li>Zwrot trafia na ten sam sposób płatności, którym zapłacono.</li>
        </ul>

        <h2>Czego ta usługa nie zmienia</h2>
        <p>
          Ochrona nie ogranicza Twoich ustawowych praw (m.in. praw konsumenta wobec sprzedawcy będącego przedsiębiorcą)
          ani możliwości zgłoszenia sporu u operatora karty. Nie dotyczy transakcji zawieranych bezpośrednio.
        </p>

        <p className="muted">
          Pytania: <a href="mailto:pomoc@bidigo.pl">pomoc@bidigo.pl</a> · <Link to="/pomoc">Pomoc</Link>
        </p>
      </div>
    </div>
  )
}
