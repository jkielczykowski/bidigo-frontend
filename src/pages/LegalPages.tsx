/** Uzupełnij po wpisie spółki do KRS. Puste pola nie pokazują się na stronie. */
export const operator = {
  brand: 'Bidigo',
  legalName: 'Loop Soft sp. z o.o.',
  address: 'ul. Herbu Oksza 10/102, 02-495 Warszawa',
  krs: '0001271402',
  nip: '5223386565',
  email: 'pomoc@bidigo.pl',
}

function OperatorBlock() {
  const filled = operator.legalName && operator.address
  if (!filled) {
    return (
      <p>
        Serwis prowadzi <strong>{operator.brand}</strong>. Pełna nazwa spółki, adres siedziby, KRS i NIP
        pojawią się tutaj po wpisie do KRS. Do tego czasu sprawy danych i konta załatwisz pod adresem{' '}
        <a href={`mailto:${operator.email}`}>{operator.email}</a>.
      </p>
    )
  }
  return (
    <p>
      Administratorem danych jest <strong>{operator.legalName}</strong>, {operator.address}
      {operator.krs ? `, KRS ${operator.krs}` : ''}
      {operator.nip ? `, NIP ${operator.nip}` : ''}. Kontakt:{' '}
      <a href={`mailto:${operator.email}`}>{operator.email}</a>.
    </p>
  )
}

export function PrivacyPolicyPage() {
  const updated = '7 października 2026'

  return (
    <div className="container narrow page legal-page">
      <header className="legal-hero">
        <p className="section-tag">Dokumenty</p>
        <h1>Polityka prywatności</h1>
        <p className="muted">Ostatnia aktualizacja: {updated}</p>
      </header>

      <div className="legal-body">
        <p>
          Niniejsza Polityka prywatności opisuje, w jaki sposób serwis <strong>Bidigo</strong>{' '}
          („Serwis”, „my”) przetwarza dane osobowe użytkowników aplikacji webowej i mobilnej.
        </p>

        <h2>1. Administrator danych</h2>
        <OperatorBlock />

        <h2>2. Jakie dane zbieramy</h2>
        <ul>
          <li>
            <strong>Konto:</strong> adres e-mail, hasło (przechowywane w postaci zaszyfrowanej u dostawcy
            logowania), imię i nazwisko albo nick, numer telefonu, data urodzenia podana przy rejestracji,
            adres (ulica, kod, miasto) oraz opcjonalnie opis profilu.
          </li>
          <li>
            <strong>Zdjęcia:</strong> pliki wybrane z galerii albo zrobione aparatem, dodawane do aukcji
            albo do wyszukiwania. Aparat i galeria są używane tylko na Twoje żądanie.
          </li>
          <li>
            <strong>Aukcje:</strong> tytuł, opis, zdjęcia, ceny, kategoria, lokalizacja oferty,
            opcje dostawy, historia ofert (licytacji).
          </li>
          <li>
            <strong>Komunikacja:</strong> wiadomości między kupującym a sprzedającym po sprzedaży,
            powiadomienia w aplikacji oraz (gdy włączone) e-maile transakcyjne.
          </li>
          <li>
            <strong>Płatności / opłaty:</strong> informacje o należnej prowizji od sprzedaży
            (bez przechowywania pełnych danych kart płatniczych w Serwisie — płatności obsługuje
            zewnętrzny operator, gdy zostanie podłączony).
          </li>
          <li>
            <strong>Na urządzeniu:</strong> zapisane wyszukiwania i obserwowani sprzedawcy trzymane lokalnie
            w aplikacji, żeby lista ulubionych działała bez dodatkowego konta w chmurze.
          </li>
          <li>
            <strong>Dane techniczne:</strong> adres IP, typ urządzenia i przeglądarki oraz logi
            bezpieczeństwa w zakresie potrzebnym do działania Serwisu.
          </li>
        </ul>

        <h2>3. Po co przetwarzamy dane</h2>
        <ul>
          <li>utworzenie i obsługa konta użytkownika,</li>
          <li>wystawianie aukcji, licytacje, kup teraz, rozliczenie prowizji,</li>
          <li>weryfikacja numeru telefonu (SMS / kod),</li>
          <li>wiadomości po zakończeniu transakcji,</li>
          <li>moderacja treści (np. oferty do przeglądu),</li>
          <li>bezpieczeństwo, zapobieganie nadużyciom i spamowi,</li>
          <li>kontakt w sprawach Serwisu oraz obowiązki prawne.</li>
        </ul>

        <h2>4. Podstawa prawna (RODO)</h2>
        <ul>
          <li>
            <strong>art. 6 ust. 1 lit. b RODO</strong> — wykonanie umowy (konto, aukcje, wiadomości),
          </li>
          <li>
            <strong>art. 6 ust. 1 lit. f RODO</strong> — prawnie uzasadniony interes (bezpieczeństwo,
            moderacja, rozwój Serwisu),
          </li>
          <li>
            <strong>art. 6 ust. 1 lit. c RODO</strong> — obowiązki prawne (np. rozliczenia, reklamacje),
          </li>
          <li>
            <strong>art. 6 ust. 1 lit. a RODO</strong> — zgoda, gdy jest wymagana (np. opcjonalne
            komunikaty marketingowe — jeśli kiedyś je włączymy).
          </li>
        </ul>

        <h2>5. Komu przekazujemy dane</h2>
        <p>Dane mogą być przetwarzane przez zaufanych dostawców usług IT działających na nasze zlecenie:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — baza danych, logowanie, przechowywanie plików (zdjęcia aukcji),
          </li>
          <li>
            <strong>hosting aplikacji</strong> — serwer, na którym działa strona / API,
          </li>
          <li>
            <strong>dostawca e-mail / SMS</strong> — gdy włączymy wysyłkę kodów i powiadomień,
          </li>
          <li>
            <strong>operator płatności</strong> (np. Przelewy24) — gdy podłączymy płatności prowizji.
          </li>
        </ul>
        <p>
          Nie sprzedajemy danych osobowych. Dane możemy ujawnić organom uprawnionym, jeśli wymaga
          tego prawo.
        </p>

        <h2>6. Przekazywanie poza EOG</h2>
        <p>
          Część dostawców może przetwarzać dane poza Europejskim Obszarem Gospodarczym.
          W takim przypadku stosujemy mechanizmy zgodne z RODO (np. standardowe klauzule umowne),
          o ile są wymagane.
        </p>

        <h2>7. Jak długo przechowujemy dane</h2>
        <ul>
          <li>dane konta — przez czas posiadania konta oraz okres niezbędny po usunięciu (np. rozliczenia, roszczenia),</li>
          <li>aukcje i oferty — przez czas działania Serwisu oraz okresy wynikające z prawa,</li>
          <li>wiadomości — przez czas potrzebny do obsługi transakcji i ewentualnych sporów,</li>
          <li>logi techniczne — zwykle krócej, o ile nie są potrzebne do bezpieczeństwa.</li>
        </ul>

        <h2>8. Twoje prawa</h2>
        <p>Masz prawo do:</p>
        <ul>
          <li>dostępu do swoich danych,</li>
          <li>sprostowania,</li>
          <li>usunięcia („prawo do bycia zapomnianym”) — w granicach prawa,</li>
          <li>ograniczenia przetwarzania,</li>
          <li>przenoszenia danych,</li>
          <li>sprzeciwu wobec przetwarzania opartego na uzasadnionym interesie,</li>
          <li>wniesienia skargi do Prezesa UODO (uodo.gov.pl).</li>
        </ul>
        <p>
          Żądania wyślesz na{' '}
          <a href={`mailto:${operator.email}`}>{operator.email}</a>. Usunięcie konta jest opisane na stronie{' '}
          <a href="/usun-konto">Usunięcie konta</a>.
        </p>

        <h2>9. Pliki cookie i podobne technologie</h2>
        <p>
          Serwis używa niezbędnych mechanizmów sesji / logowania (np. tokeny dostępu), żebyś mógł
          pozostać zalogowany. Nie opieramy się na reklamowych cookie stron trzecich.
          Analityka — jeśli zostanie dodana — zostanie opisana w tej polityce.
        </p>

        <h2>10. Bezpieczeństwo</h2>
        <p>
          Stosujemy typowe środki ochrony (szyfrowanie połączenia HTTPS, kontrola dostępu,
          izolacja uprawnień w bazie). Żaden system nie jest w 100% odporny — dbamy o minimalizację
          ryzyka.
        </p>

        <h2>11. Dzieci</h2>
        <p>
          Serwis nie jest skierowany do osób poniżej 16. roku życia. Jeśli dowiemy się, że konto
          utworzyła osoba młodsza bez wymaganej zgody, usuniemy je.
        </p>

        <h2>12. Zmiany polityki</h2>
        <p>
          Politykę możemy aktualizować. Nowa wersja będzie publikowana pod tym samym adresem URL
          z datą aktualizacji. Istotne zmiany możemy dodatkowo ogłosić w Serwisie.
        </p>

        <h2>13. Kontakt</h2>
        <p>
          Pytania o prywatność: <a href={`mailto:${operator.email}`}>{operator.email}</a>
        </p>
      </div>
    </div>
  )
}

export function TermsPage() {
  const updated = '17 listopada 2026'

  return (
    <div className="container narrow page legal-page">
      <header className="legal-hero">
        <p className="section-tag">Dokumenty</p>
        <h1>Regulamin</h1>
        <p className="muted">Ostatnia aktualizacja: {updated}</p>
      </header>

      <div className="legal-body">
        <p>
          Niniejszy Regulamin określa zasady korzystania z marketplace aukcyjnego{' '}
          <strong>Bidigo</strong> (strona i aplikacja mobilna).
        </p>

        <h2>1. Postanowienia ogólne</h2>
        <ol>
          <li>Serwis umożliwia wystawianie aukcji, składanie ofert (licytację), zawieranie transakcji oraz komunikację po sprzedaży.</li>
          <li>Korzystanie z Serwisu wymaga konta oraz akceptacji Regulaminu i Polityki prywatności.</li>
          <li>Licytować i sprzedawać może osoba, która ukończyła 18 lat.</li>
          <li>Operatorem Serwisu jest podmiot wskazany w Polityce prywatności.</li>
        </ol>

        <h2>2. Konto</h2>
        <ol>
          <li>Użytkownik podaje prawdziwe dane (w szczególności e-mail i telefon).</li>
          <li>Numer telefonu może wymagać weryfikacji kodem.</li>
          <li>Zabrania się zakładania kont w celu spamowania, oszustwa lub obchodzenia blokad.</li>
          <li>Możemy zawiesić lub usunąć konto przy naruszeniu Regulaminu, na zasadach opisanych w punkcie 8.</li>
          <li>
            Konto usuniesz według instrukcji na stronie <a href="/usun-konto">Usunięcie konta</a>.
          </li>
        </ol>

        <h2>3. Aukcje i oferty</h2>
        <ol>
          <li>Sprzedający odpowiada za treść oferty, zdjęcia, stan przedmiotu i prawo do sprzedaży.</li>
          <li>Zabrania się treści nielegalnych, obraźliwych, wprowadzających w błąd oraz towarów zakazanych.</li>
          <li>Oferta (bid) jest wiążąca w ramach zasad aukcji; „Kup teraz” kończy sprzedaż natychmiast.</li>
          <li>Oferty mogą podlegać moderacji przed publikacją.</li>
        </ol>

        <h2>4. Opłaty</h2>
        <ol>
          <li>Wystawianie aukcji, licytowanie i sprzedaż są bezpłatne. Od sprzedaży zawartych po zmianie modelu nie pobieramy prowizji od sprzedającego.</li>
          <li>
            Prowizje naliczone przed zmianą modelu (sprzedaże z wcześniejszych aukcji) pozostają należne na dotychczasowych
            zasadach i są widoczne w sekcji „Opłaty”.
          </li>
          <li>
            Jedyną opłatą w nowym modelu jest opcjonalna opłata za Ochronę Kupującego (punkt 6), płacona przez kupującego.
            Jej wysokość ustala Bidigo (może zależeć od kategorii i podlegać promocjom) i jest pokazywana kupującemu przed
            płatnością, razem z ceną przedmiotu i kosztem dostawy.
          </li>
        </ol>

        <h2>5. Zamówienia</h2>
        <ol>
          <li>
            Gdy aukcja kończy się sprzedażą (zwycięska oferta albo „Kup teraz”), powstaje zamówienie widoczne w sekcji
            „Zamówienia” kupującego i sprzedającego. Kupujący i sprzedający mogą też rozmawiać na czacie.
          </li>
          <li>
            Dla przedmiotów, które kwalifikują się do Ochrony Kupującego, kupujący wybiera: zapłatę w Bidigo z Ochroną albo
            transakcję bezpośrednią. Dla pozostałych przedmiotów transakcja odbywa się bezpośrednio między stronami (odbiór
            osobisty lub wysyłka ustalona na czacie) — płatności i rozliczenia stron Bidigo wtedy nie obsługuje.
          </li>
          <li>
            Jeśli kupujący nie zapłaci z Ochroną w podanym w zamówieniu terminie, zamówienie staje się zwykłą transakcją
            bezpośrednią.
          </li>
          <li>
            Zamówienie można anulować do momentu nadania paczki. Anulowanie opłaconego zamówienia przed nadaniem oznacza
            zwrot całej wpłaty, razem z opłatą za ochronę.
          </li>
        </ol>

        <h2>6. Ochrona Kupującego</h2>
        <ol>
          <li>
            Ochrona Kupującego to opcjonalna, płatna usługa dostępna dla przedmiotów wysyłanych Paczkomatem InPost.
            Serwis sam ocenia, czy przedmiot się kwalifikuje: sprzedający musi zadeklarować wysyłkę Paczkomatem i podać
            wymiary, wagę oraz koszt wysyłki, a paczka musi mieścić się w limitach przewoźnika. Usługa może być niedostępna
            dla niektórych kategorii lub cen. Przedmiot, który się nie kwalifikuje, jest sprzedawany bezpośrednio.
          </li>
          <li>
            Kupujący płaci w Bidigo cenę przedmiotu, koszt dostawy i opłatę za ochronę. Płatności obsługuje zewnętrzny
            operator płatności; Bidigo nie przechowuje danych karty.
          </li>
          <li>
            Po doręczeniu kupujący potwierdza odbiór albo w terminie podanym w zamówieniu zgłasza problem (paczka nie dotarła,
            jest uszkodzona lub niezgodna z opisem). Bez zgłoszenia zamówienie kończy się samo po upływie tego terminu.
          </li>
          <li>
            Zgłoszenie rozpatruje Bidigo, po wysłuchaniu obu stron. Decyzja może przewidywać zwrot pełny, częściowy albo jego
            brak. Zwrot trafia na pierwotny sposób płatności.
          </li>
          <li>
            Ochrona nie ogranicza ustawowych praw kupującego, w tym praw konsumenta wobec sprzedawcy będącego przedsiębiorcą,
            ani prawa do zgłoszenia reklamacji czy sporu u operatora karty.
          </li>
        </ol>

        <h2>7. Przesyłki InPost</h2>
        <ol>
          <li>Wysyłka Paczkomatem InPost odbywa się na zasadach przewoźnika; sprzedający odpowiada za prawidłowe zapakowanie i dane paczki.</li>
          <li>Wymiary i waga podane w ofercie muszą odpowiadać rzeczywistej paczce. Podanie nieprawdziwych danych może skutkować utratą dostępu do Ochrony.</li>
          <li>Kupujący odbiera paczkę w wybranym Paczkomacie w terminie wyznaczonym przez przewoźnika; nieodebranie przesyłki może być uznane za naruszenie (punkt 8).</li>
        </ol>

        <h2>8. Zasady antyfraudowe i blokady</h2>
        <ol>
          <li>
            Naruszeniem są w szczególności: niezapłacenie za wygraną aukcję lub zamówienie, nieodebranie paczki, niewysłanie
            sprzedanego przedmiotu, nadużywanie zgłoszeń oraz próby obejścia blokady.
          </li>
          <li>
            Przed uznaniem naruszenia dajemy użytkownikowi możliwość wyjaśnienia sprawy. Naruszenie potwierdza człowiek;
            użytkownik jest informowany o decyzji i może się od niej odwołać w wyznaczonym terminie. Uznane odwołanie
            anuluje naruszenie.
          </li>
          <li>
            Trzecie potwierdzone naruszenie w okresie 12 miesięcy skutkuje blokadą możliwości licytowania, kupowania
            i wystawiania. Terminy i próg mogą zostać zmienione; aktualnie obowiązujące wartości podajemy w komunikacie
            o naruszeniu.
          </li>
          <li>
            W celu zapobiegania nadużyciom przechowujemy w zabezpieczonej formie (jako skrót kryptograficzny) adres e-mail
            i numer telefonu zablokowanych kont przez ograniczony czas; szczegóły w <a href="/privacy">Polityce prywatności</a>.
          </li>
        </ol>

        <h2>9. Wiadomości</h2>
        <ol>
          <li>Czat kupujący–sprzedający aktywuje się po zakończonej sprzedaży.</li>
          <li>Zabrania się nękania, spamowania i udostępniania treści zabronionych.</li>
        </ol>

        <h2>10. Odpowiedzialność</h2>
        <ol>
          <li>
            Serwis jest platformą pośredniczącą — nie jest stroną umowy sprzedaży między użytkownikami (chyba że wyraźnie
            wskazano inaczej). Ochrona Kupującego jest odrębną usługą Bidigo opisaną w punkcie 6.
          </li>
          <li>
            Nie gwarantujemy, że każda transakcja zakończy się bez problemów. Ogłoszenie, użytkownika
            albo nadużycie zgłoś na <a href={`mailto:${operator.email}`}>{operator.email}</a>.
          </li>
          <li>Dokładamy starań, by Serwis działał, ale mogą występować przerwy techniczne.</li>
        </ol>

        <h2>11. Reklamacje i kontakt</h2>
        <p>
          Reklamacje i zgłoszenia: <a href={`mailto:${operator.email}`}>{operator.email}</a>.
          Pomoc: <a href="/pomoc">bidigo.pl/pomoc</a>.
        </p>

        <h2>12. Zmiany regulaminu</h2>
        <p>
          Możemy zmieniać Regulamin. Aktualna wersja jest publikowana w Serwisie. Dalsze korzystanie
          po zmianie oznacza akceptację, o ile przepisy nie stanowią inaczej.
        </p>

        <p className="muted" style={{ marginTop: '2rem' }}>
          Zobacz też: <a href="/ochrona-kupujacego">Ochrona Kupującego</a>
          {' · '}
          <a href="/privacy">Polityka prywatności</a>
          {' · '}
          <a href="/pomoc">Pomoc</a>
          {' · '}
          <a href="/usun-konto">Usunięcie konta</a>
        </p>
      </div>
    </div>
  )
}

export function SupportPage() {
  return (
    <div className="container narrow page legal-page">
      <header className="legal-hero">
        <p className="section-tag">Dokumenty</p>
        <h1>Pomoc</h1>
      </header>
      <div className="legal-body">
        <p>
          Napisz na <a href={`mailto:${operator.email}`}>{operator.email}</a>. Odpowiadamy w sprawie
          konta, aukcji, licytacji, opłat i zgłoszeń nadużyć.
        </p>
        <h2>Przydatne strony</h2>
        <ul>
          <li><a href="/privacy">Polityka prywatności</a></li>
          <li><a href="/terms">Regulamin</a></li>
          <li><a href="/usun-konto">Usunięcie konta</a></li>
        </ul>
        <OperatorBlock />
      </div>
    </div>
  )
}

export function AccountDeletionPage() {
  const updated = '7 października 2026'
  return (
    <div className="container narrow page legal-page">
      <header className="legal-hero">
        <p className="section-tag">Dokumenty</p>
        <h1>Usunięcie konta</h1>
        <p className="muted">Ostatnia aktualizacja: {updated}</p>
      </header>
      <div className="legal-body">
        <p>Konto w Bidigo usuniesz w ten sposób:</p>
        <ol>
          <li>Zaloguj się na stronie i otwórz Ustawienia profilu albo napisz od razu z adresu e-mail konta.</li>
          <li>
            Wyślij wiadomość na <a href={`mailto:${operator.email}?subject=Usuni%C4%99cie%20konta`}>{operator.email}</a>{' '}
            z tematem „Usunięcie konta”. W treści podaj adres e-mail konta.
          </li>
          <li>Potwierdzimy prośbę i usuniemy konto w ciągu 30 dni.</li>
        </ol>
        <p>
          Po usunięciu znikają profil, zdjęcia i wiadomości przypisane do konta. Zostawiamy dane, których
          wymaga prawo albo rozliczenie zakończonej transakcji: historię ofert i opłat, w zakresie potrzebnym
          drugiej stronie umowy i przez okres przedawnienia roszczeń. Te dane nie służą już do logowania.
        </p>
        <p>Ta sama instrukcja dotyczy strony oraz aplikacji na iPhone i Androida.</p>
        <OperatorBlock />
      </div>
    </div>
  )
}
