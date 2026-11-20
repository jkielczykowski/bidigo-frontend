import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import {
  EMPTY_FORM, KIND_LABEL, expireDateError, isIdDocument, STATUS_LABEL, STATUS_TONE, documentFileError, formatIban, formatZip, stepForState, validateKycForm,
  type KycForm, type KycFormErrors, type KycKind, type KycState, type KycStep,
} from '../lib/sellerKyc'
import {
  KycApiError, completeKyc, confirmRegulationsAccepted, fetchKyc, refreshKyc, sendKycData, startKyc, uploadKycDocument,
} from '../lib/sellerKycApi'
import './shipping.css'
import './payout.css'

const STEPS: { key: KycStep[]; label: string }[] = [
  { key: ['kind'], label: 'Typ' },
  { key: ['data'], label: 'Dane' },
  { key: ['regulations'], label: 'Regulamin' },
  { key: ['documents'], label: 'Dokumenty' },
  { key: ['waiting', 'verified', 'rejected'], label: 'Weryfikacja' },
]

const FIELDS: { name: keyof KycForm; label: string; type?: string; autoComplete?: string; hint?: string; trader?: boolean; inputMode?: 'numeric' | 'tel' | 'email' }[] = [
  { name: 'firstName', label: 'Imię', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Nazwisko', autoComplete: 'family-name' },
  { name: 'birthDate', label: 'Data urodzenia', type: 'date', autoComplete: 'bday' },
  { name: 'companyName', label: 'Nazwa działalności', trader: true, autoComplete: 'organization' },
  { name: 'nip', label: 'NIP', trader: true, inputMode: 'numeric', hint: '10 cyfr, bez kresek' },
  { name: 'pesel', label: 'PESEL (opcjonalnie)', trader: true, inputMode: 'numeric', hint: 'Może przyspieszyć weryfikację działalności' },
  { name: 'street', label: 'Ulica i numer', autoComplete: 'street-address' },
  { name: 'zipcode', label: 'Kod pocztowy', autoComplete: 'postal-code', inputMode: 'numeric', hint: 'Format 00-000' },
  { name: 'city', label: 'Miejscowość', autoComplete: 'address-level2' },
  { name: 'phone', label: 'Telefon', type: 'tel', autoComplete: 'tel', inputMode: 'tel', hint: 'Polski numer, 9 cyfr' },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email', inputMode: 'email' },
  { name: 'iban', label: 'Numer rachunku bankowego (IBAN)', inputMode: 'numeric', hint: 'Rachunek, na który wypłacimy pieniądze: PL i 26 cyfr' },
]

export function MyPayoutPage() {
  const { user } = useAuth()
  const [state, setState] = useState<KycState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<KycKind>('PRIVATE_PERSON')
  const [form, setForm] = useState<KycForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<KycFormErrors>({})
  const [restart, setRestart] = useState(false)
  const [uploaded, setUploaded] = useState<Set<string>>(new Set())
  const [regsOk, setRegsOk] = useState(false)

  const load = useCallback(async () => {
    try {
      const s = await fetchKyc()
      setState(s)
      if (s.kind) setKind(s.kind)
      setLoadError(null)
    } catch (e) {
      setLoadError(errorMessage(e, 'Nie udało się wczytać stanu weryfikacji'))
    }
  }, [])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  const step: KycStep | null = state ? (restart ? 'kind' : stepForState(state)) : null

  // oczekiwanie na operatora: co kilkanaście sekund prosimy serwer o odczyt stanu
  useEffect(() => {
    if (step !== 'waiting') return
    const t = setInterval(() => void refreshKyc().then(setState).catch(() => {}), 15_000)
    return () => clearInterval(t)
  }, [step])

  async function run(fn: () => Promise<KycState | void>) {
    setBusy(true)
    setError(null)
    try {
      const s = await fn()
      if (s) setState(s)
    } catch (e) {
      if (e instanceof KycApiError && e.field) setErrors((p) => ({ ...p, [e.field as keyof KycForm]: e.message }))
      setError(errorMessage(e, 'Nie udało się wykonać operacji'))
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="container page">
        <p><Link to="/login">Zaloguj się</Link>, żeby podać dane do wypłaty.</p>
      </div>
    )
  }
  if (!state) return <div className="container page">{loadError ? <p className="error">{loadError}</p> : <p className="muted">Ładowanie…</p>}</div>

  const traderKind = kind === 'SOLE_TRADER'
  const set = (name: keyof KycForm, value: string) => {
    const v = name === 'zipcode' ? formatZip(value) : name === 'iban' ? formatIban(value) : value
    setForm((f) => ({ ...f, [name]: v }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }
  const activeIdx = STEPS.findIndex((s) => step && s.key.includes(step))
  const docsLeft = state.documentsRequested.filter((d) => !uploaded.has(d.code))

  return (
    <div className="container page payout-page">
      <p><Link to="/my/orders">← Zamówienia</Link></p>
      <h1>Dane do wypłaty</h1>
      <p className="muted">
        Żeby pieniądze za sprzedane przedmioty mogły do Ciebie trafić, operator płatności musi potwierdzić, kim jesteś. Robimy to raz.
        Twoich danych osobowych nie zapisujemy w Bidigo po ich wysłaniu do operatora: zostaje tylko stan weryfikacji.
      </p>
      <p>
        <span className={`order-status tone-${STATUS_TONE[state.status]}`} data-testid="kyc-status">{STATUS_LABEL[state.status]}</span>
      </p>

      <ol className="payout-steps" aria-label="Kroki">
        {STEPS.map((s, i) => (
          <li key={s.label} className={i < activeIdx ? 'done' : i === activeIdx ? 'now' : ''} aria-current={i === activeIdx ? 'step' : undefined}>{s.label}</li>
        ))}
      </ol>

      {error && <p className="error" role="alert" data-testid="kyc-error">{error}</p>}

      {step === 'kind' && (
        <section className="ship-card" data-testid="kyc-step-kind">
          <h3>Kim jesteś jako sprzedający?</h3>
          <div className="ship-sizes">
            {(Object.keys(KIND_LABEL) as KycKind[]).map((k) => (
              <label key={k} className={`ship-size${kind === k ? ' on' : ''}`}>
                <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                <strong>{KIND_LABEL[k]}</strong>
                <span className="hint payout-block">
                  {k === 'PRIVATE_PERSON' ? 'Sprzedajesz okazjonalnie rzeczy ze swojego domu.' : 'Prowadzisz firmę i sprzedajesz w jej ramach. Potrzebny będzie NIP.'}
                </span>
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(async () => {
            const s = await startKyc(kind)
            setRestart(false)
            setUploaded(new Set())
            return s
          })}>Dalej</button>
        </section>
      )}

      {step === 'data' && (
        <form className="ship-card" data-testid="kyc-step-data" noValidate onSubmit={(e) => {
          e.preventDefault()
          const errs = validateKycForm(form, kind)
          setErrors(errs)
          if (Object.keys(errs).length > 0) return
          void run(async () => {
            const s = await sendKycData(form, kind)
            setForm(EMPTY_FORM) // po wysłaniu nie trzymamy danych osobowych w pamięci strony
            return s
          })
        }}>
          <h3>Twoje dane ({KIND_LABEL[kind].toLowerCase()})</h3>
          <div className="payout-grid">
            {FIELDS.filter((f) => !f.trader || traderKind).map((f) => (
              <label key={f.name} className={errors[f.name] ? 'has-error' : undefined}>
                <span className="label-text">{f.label}</span>
                <input
                  name={f.name} type={f.type ?? 'text'} value={form[f.name]} autoComplete={f.autoComplete} inputMode={f.inputMode}
                  aria-invalid={errors[f.name] ? true : undefined} aria-describedby={`err-${f.name}`}
                  onChange={(e) => set(f.name, e.target.value)}
                />
                {errors[f.name] ? <span id={`err-${f.name}`} className="field-error" role="alert">{errors[f.name]}</span> : f.hint && <span className="field-hint">{f.hint}</span>}
              </label>
            ))}
          </div>
          <div className="ship-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Wysyłamy…' : 'Wyślij dane i przejdź dalej'}</button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setRestart(true)}>Zmień typ</button>
          </div>
        </form>
      )}

      {step === 'regulations' && state.widgetUrl && state.shopId && state.extCustomerId && (
        <section className="ship-card" data-testid="kyc-step-regulations">
          <h3>Regulamin operatora płatności</h3>
          <p>Wypłaty obsługuje operator płatności, więc jego regulamin musisz zaakceptować sam. Zaznacz zgodę poniżej.</p>
          <label className="check-row">
            <input type="checkbox" checked={regsOk} onChange={(e) => setRegsOk(e.target.checked)} data-testid="payout-regulations-check" />
            <span>
              Znam i akceptuję{' '}
              <a href="http://static.payu.com/regulations/marketplace-psd2-regulation-v2.pdf" target="_blank" rel="noreferrer">regulamin operatora płatności</a>
              {' '}dotyczący wypłat dla sprzedających.
            </span>
          </label>
          <div className="ship-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !regsOk} onClick={() => void run(async () => {
              const s = await confirmRegulationsAccepted()
              if (s.documentsRequested.length === 0 && s.status !== 'verified') return completeKyc()
              return s
            })}>Akceptuję i wysyłam do weryfikacji</button>
          </div>
        </section>
      )}
      {step === 'regulations' && !(state.widgetUrl && state.shopId && state.extCustomerId) && (
        <section className="ship-card"><p className="error">Okno akceptacji regulaminu jest chwilowo niedostępne. Spróbuj później.</p>
          <button type="button" className="btn btn-outline" onClick={() => void load()}>Odśwież</button></section>
      )}

      {step === 'documents' && (
        <section className="ship-card" data-testid="kyc-step-documents">
          <h3>Dokumenty do weryfikacji</h3>
          <p>Operator płatności prosi o dodatkowe dokumenty. Dozwolone: PDF, JPG, PNG, do 1 MB każdy.</p>
          {state.documentsRequested.map((d) => (
            <DocumentRow key={d.code} label={d.label} done={uploaded.has(d.code)} busy={busy}
              id={d.code} onSubmit={(file, opts) => run(async () => { const s = await uploadKycDocument(d.code, file, opts); setUploaded((u) => new Set(u).add(d.code)); return s })} />
          ))}
          <div className="ship-actions">
            <button type="button" className="btn btn-primary" disabled={busy || docsLeft.length > 0} onClick={() => void run(completeKyc)}>Wyślij do weryfikacji</button>
          </div>
        </section>
      )}

      {step === 'waiting' && (
        <section className="ship-card" data-testid="kyc-step-waiting">
          <h3>Czekamy na operatora płatności</h3>
          <p>Twoje dane zostały wysłane. Weryfikacja zwykle trwa krótko; ta strona sama sprawdza stan. Możesz ją zamknąć, damy znać, gdy będzie gotowe.</p>
          {state.message && <p className="ship-notice">{state.message}</p>}
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run(refreshKyc)}>Sprawdź teraz</button>
        </section>
      )}

      {step === 'verified' && (
        <section className="ship-card" data-testid="kyc-step-verified">
          <h3>Dane do wypłaty zweryfikowane</h3>
          <p className="success">Gotowe. Możesz sprzedawać z Ochroną Bidigo, a pieniądze trafią na Twój rachunek po potwierdzeniu odbioru przez kupującego.</p>
          <Link className="btn btn-primary" to="/my/orders">Wróć do zamówień</Link>
        </section>
      )}

      {step === 'rejected' && (
        <section className="ship-card" data-testid="kyc-step-rejected">
          <h3>Weryfikacja odrzucona</h3>
          <p>Operator płatności nie zweryfikował Twoich danych.</p>
          {(state.lastError || state.message) && <p className="ship-notice" role="alert">{state.lastError ?? state.message}</p>}
          <p className="hint">Sprawdź, czy imię, nazwisko, data urodzenia i numer rachunku zgadzają się z dokumentami. Jeśli problem wraca, napisz do nas.</p>
          <button type="button" className="btn btn-primary" onClick={() => { setRestart(true); setError(null) }}>Spróbuj ponownie</button>
        </section>
      )}
    </div>
  )
}

function DocumentRow({ id, label, done, busy, onSubmit }: {
  id: string; label: string; done: boolean; busy: boolean
  onSubmit: (file: File, opts: { fileBack?: File | null; expireDate?: string }) => Promise<void>
}) {
  const idDoc = isIdDocument(id)
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [expire, setExpire] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const pick = (set: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    const bad = f ? documentFileError(f) : null
    setErr(bad)
    set(bad ? null : f)
    if (bad) e.target.value = ''
  }
  const accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
  return (
    <div className="payout-doc" data-testid={`kyc-doc-${id}`}>
      <strong>{label}</strong> {done && <span className="ship-chip ok">Wysłano</span>}
      {!done && (
        <>
          <label className="payout-file"><span className="label-text">{idDoc ? 'Przód' : 'Plik'}</span>
            <input type="file" accept={accept} disabled={busy} onChange={pick(setFront)} /></label>
          {idDoc && (
            <>
              <label className="payout-file"><span className="label-text">Tył (jeśli dokument ma drugą stronę)</span>
                <input type="file" accept={accept} disabled={busy} onChange={pick(setBack)} /></label>
              <label className="payout-file"><span className="label-text">Data ważności dokumentu</span>
                <input type="date" value={expire} disabled={busy} onChange={(e) => { setExpire(e.target.value); setErr(null) }} /></label>
            </>
          )}
          {err && <span className="field-error" role="alert">{err}</span>}
          <div><button type="button" className="btn btn-outline btn-sm" disabled={busy || !front} onClick={() => {
            const e = idDoc ? expireDateError(expire) : null
            if (e) return setErr(e)
            if (front) void onSubmit(front, { fileBack: back, expireDate: idDoc ? expire : undefined })
          }}>Wyślij dokument</button></div>
        </>
      )}
    </div>
  )
}
