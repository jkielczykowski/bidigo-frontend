import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AntifraudBanner } from '../components/AntifraudBanner'
import '../components/AntifraudBanner.css'
import {
  appealProblem,
  daysLeft,
  explanationProblem,
  statusLabel,
  strikeLabel,
  type AfIncident,
} from '../lib/antifraud'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAntifraud } from '../lib/useAntifraud'

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pl-PL') : '—'
}

function IncidentCard({ incident, onChanged }: { incident: AfIncident; onChanged: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(kind: 'explain' | 'appeal', e: FormEvent) {
    e.preventDefault()
    const problem = kind === 'explain' ? explanationProblem(text) : appealProblem(text)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: err } =
        kind === 'explain'
          ? await supabase.rpc('antifraud_submit_explanation', { p_incident: incident.id, p_text: text.trim() })
          : await supabase.rpc('antifraud_submit_appeal', { p_incident: incident.id, p_text: text.trim() })
      if (err) throw err
      setText('')
      onChanged()
    } catch (err) {
      setError(errorMessage(err, 'Nie udało się wysłać. Spróbuj ponownie.'))
    } finally {
      setBusy(false)
    }
  }

  const bad = incident.status === 'VIOLATION_CONFIRMED' || incident.status === 'APPEAL_REJECTED'
  const wait = incident.status === 'AWAITING_EXPLANATION' || incident.status === 'APPEALED' || incident.status === 'UNDER_REVIEW'

  return (
    <article className="af-page-card" data-testid="antifraud-incident">
      <h3>{incident.event_label.charAt(0).toUpperCase() + incident.event_label.slice(1)}</h3>
      <p className="af-meta">
        <span className={`af-status${bad ? ' af-status-bad' : wait ? ' af-status-wait' : ''}`}>{statusLabel(incident.status)}</span>{' '}
        · {when(incident.created_at)} ·{' '}
        <Link to={`/auction/${incident.auction_id}`}>{incident.auction_title ?? 'aukcja'}</Link>
      </p>

      {incident.strike_number != null && (
        <p className="af-meta">
          Naruszenie nr {incident.strike_number}
          {incident.action_taken === 'block' ? ' — blokada konta' : ' — negatywna ocena systemowa'}
        </p>
      )}

      {incident.decision_reason && (
        <>
          <p className="af-meta">Uzasadnienie decyzji:</p>
          <p className="af-quote">{incident.decision_reason}</p>
        </>
      )}

      {incident.user_explanation && (
        <>
          <p className="af-meta">Twoje wyjaśnienia:</p>
          <p className="af-quote">{incident.user_explanation}</p>
        </>
      )}

      {incident.can_explain && (
        <form className="af-form" onSubmit={(e) => void send('explain', e)}>
          <p className="af-meta">
            Opisz swoją wersję wydarzeń (np. problem z płatnością, paczką, kontakt ze sprzedającym). Zostało {daysLeft(incident.explanation_deadline)}{' '}
            dni. Nic nie zostało jeszcze naliczone.
          </p>
          <label className="field-label" htmlFor={`ex-${incident.id}`}>
            Twoje wyjaśnienia
          </label>
          <textarea id={`ex-${incident.id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Wysyłanie…' : 'Wyślij wyjaśnienia'}
          </button>
        </form>
      )}

      {incident.appeal_text && (
        <>
          <p className="af-meta">Twoje odwołanie:</p>
          <p className="af-quote">{incident.appeal_text}</p>
        </>
      )}
      {incident.appeal_decision_reason && (
        <>
          <p className="af-meta">Decyzja w sprawie odwołania:</p>
          <p className="af-quote">{incident.appeal_decision_reason}</p>
        </>
      )}

      {incident.can_appeal && (
        <form className="af-form" onSubmit={(e) => void send('appeal', e)}>
          <p className="af-meta">
            Nie zgadzasz się z decyzją? Możesz się odwołać do {when(incident.appeal_deadline)} ({daysLeft(incident.appeal_deadline)} dni). Odwołanie rozpatruje
            osoba z zespołu Bidigo.
          </p>
          <label className="field-label" htmlFor={`ap-${incident.id}`}>
            Treść odwołania
          </label>
          <textarea id={`ap-${incident.id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Wysyłanie…' : 'Odwołaj się'}
          </button>
        </form>
      )}
    </article>
  )
}

export function MySecurityPage() {
  const { user } = useAuth()
  const { status, reload } = useAntifraud()

  if (!user) {
    return (
      <div className="container page">
        <p>
          <Link to="/login">Zaloguj się</Link>, żeby zobaczyć stan konta.
        </p>
      </div>
    )
  }

  return (
    <div className="container narrow page">
      <div className="page-hero">
        <h1>
          Bezpieczeństwo <span>konta</span>
        </h1>
        <p>Ostrzeżenia, oceny systemowe, wyjaśnienia i odwołania dotyczące Twoich transakcji.</p>
      </div>

      <AntifraudBanner status={status} />

      {status && (
        <section className="af-page-card" aria-labelledby="af-policy">
          <h2 id="af-policy">Zasady</h2>
          <p className="af-meta">
            Naruszenie zasad transakcji to np. wygrana, ale nieopłacona aukcja, odmowa sfinalizowania zakupu bez uzasadnienia, powtarzające się
            nieodbieranie paczek, oferty bez zamiaru zakupu albo oszustwo. Nie każde nieodebranie paczki jest naruszeniem — zawsze sprawdzamy
            płatność, status przesyłki, problemy techniczne, spory i to, czy sprzedający dotrzymał swojej części. Przed naliczeniem możesz
            przedstawić swoją wersję, a decyzję podejmuje człowiek.
          </p>
          <p className="af-meta">
            Każde potwierdzone naruszenie to negatywna ocena systemowa. Przy {strikeLabel(status.threshold - 1, status.threshold)} dostajesz
            ostrzeżenie o ryzyku blokady, a po {status.threshold}. naruszeniu w ciągu {status.window_months} mies. konto zostaje zablokowane
            (licytowanie, kupowanie i wystawianie). Od każdej decyzji możesz się odwołać w ciągu {status.appeal_days} dni. Twój stan:{' '}
            <strong>{strikeLabel(status.strikes, status.threshold)}</strong>.
          </p>
        </section>
      )}

      {status?.incidents.length === 0 && <p className="muted">Brak zgłoszeń dotyczących Twojego konta.</p>}
      {status?.incidents.map((i) => (
        <IncidentCard key={i.id} incident={i} onChanged={() => void reload()} />
      ))}

      {status && status.ratings.length > 0 && (
        <section className="af-page-card" aria-labelledby="af-ratings">
          <h2 id="af-ratings">Oceny systemowe</h2>
          <ul>
            {status.ratings.map((r) => (
              <li key={r.id}>
                Negatywna ocena systemowa — {r.reason_label}, {when(r.created_at)}
                {r.revoked_at ? ` (wycofana ${when(r.revoked_at)})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
