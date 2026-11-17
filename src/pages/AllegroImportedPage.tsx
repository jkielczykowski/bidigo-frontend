import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AllegroTabs } from '../components/AllegroTabs'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/bidigoApi'
import { allegroOffer } from '../lib/allegroApi'
import { fetchAllOffers } from '../lib/allegroOffersAll'
import { importedTexts, planSync, type LinkedListing, type OfferTexts, type SyncPlan } from '../lib/allegroSync'
import { myLinkedListings, syncCancel, syncUpdate } from '../lib/allegroSyncApi'
import { formatPln } from '../lib/format'

const PER_VIEW = 20

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktywna',
  sold: 'Sprzedana',
  ended: 'Zakończona',
  cancelled: 'Anulowana',
  draft: 'Szkic',
}

type Filter = 'all' | 'active' | 'closed'

function when(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

/** /sell/import/imported: the table of listings that came from Allegro, and the sync with the Allegro offers. */
export function AllegroImportedPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [linked, setLinked] = useState<LinkedListing[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState(0)
  const [sync, setSync] = useState<'idle' | 'fetching' | 'checking' | 'ready' | 'applying' | 'done'>('idle')
  const [plan, setPlan] = useState<SyncPlan | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    myLinkedListings()
      .then(setLinked)
      .catch(() => setError('Nie udało się wczytać zaimportowanych aukcji.'))
  }, [user])

  const rows = useMemo(
    () =>
      (linked ?? []).filter((l) =>
        filter === 'all' ? true : filter === 'active' ? l.status === 'active' || l.status === 'draft' : l.status !== 'active' && l.status !== 'draft',
      ),
    [linked, filter],
  )
  const pages = Math.max(1, Math.ceil(rows.length / PER_VIEW))
  const current = Math.min(view, pages - 1)
  const shown = rows.slice(current * PER_VIEW, (current + 1) * PER_VIEW)
  const activeCount = (linked ?? []).filter((l) => l.status === 'active').length

  /** Fetches all the Allegro offers, then the current text of the ones that may still change, and plans the changes. */
  async function checkSync() {
    setSync('fetching')
    setSyncMsg(null)
    setConfirmCancel(false)
    setProgress({ done: 0, total: 0 })
    try {
      const all = await fetchAllOffers(
        (got, total) => alive.current && setProgress({ done: got.length, total }),
        () => !alive.current,
      )
      if (!all) return
      const fresh = await myLinkedListings()
      setLinked(fresh)
      const present = new Set(all.offers.map((o) => o.id))
      const todo = fresh.filter((l) => l.status === 'active' && l.bidCount === 0 && present.has(l.offerId))
      const texts = new Map<string, OfferTexts>()
      setSync('checking')
      setProgress({ done: 0, total: todo.length })
      for (const [i, l] of todo.entries()) {
        try {
          texts.set(l.offerId, importedTexts(await allegroOffer(l.offerId)))
        } catch {
          // this one is skipped; the rest still compare
        }
        if (!alive.current) return
        setProgress({ done: i + 1, total: todo.length })
      }
      setPlan(planSync(fresh, present, all.complete, texts))
      if (!all.complete && fresh.some((l) => l.status === 'active' && !present.has(l.offerId))) {
        setSyncMsg('Nie pobraliśmy całej listy ofert z Allegro, więc niczego nie anulujemy. Spróbuj ponownie.')
      }
      setSync('ready')
    } catch (e) {
      if (!alive.current) return
      setSyncMsg(
        e instanceof ApiError && e.status === 409
          ? 'Połączenie z Allegro wygasło. Połącz konto ponownie na ekranie „Połączenie”.'
          : 'Nie udało się sprawdzić zmian. Spróbuj ponownie.',
      )
      setSync('idle')
    }
  }

  async function applySync() {
    if (!plan) return
    setSync('applying')
    const jobs = [
      ...plan.update.map((u) => () => syncUpdate(u.auctionId, u.title, u.description)),
      ...plan.cancel.map((c) => () => syncCancel(c.auctionId)),
    ]
    setProgress({ done: 0, total: jobs.length })
    let failed = 0
    for (const [i, job] of jobs.entries()) {
      try {
        await job()
      } catch {
        failed += 1
      }
      if (!alive.current) return
      setProgress({ done: i + 1, total: jobs.length })
    }
    setLinked(await myLinkedListings().catch(() => linked))
    setSyncMsg(
      failed === 0
        ? `Gotowe: zmieniono ${plan.update.length}, anulowano ${plan.cancel.length}.`
        : `Zakończono z błędami: ${failed} z ${jobs.length} zmian się nie powiodło. Sprawdź ponownie.`,
    )
    setPlan(null)
    setConfirmCancel(false)
    setSync('done')
  }

  if (loading || !user) {
    return (
      <div className="container page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  const working = sync === 'fetching' || sync === 'checking' || sync === 'applying'
  const pct = progress.total > 0 ? Math.max(4, Math.round((progress.done / progress.total) * 100)) : 4

  return (
    <div className="container page alg alg-wide imp">
      <h1>Import z Allegro</h1>
      <AllegroTabs />

      {error && <p className="alg-note is-err">{error}</p>}

      <section className="alg-sync">
        <h2>Synchronizacja z Allegro</h2>
        <p className="muted">
          Porównamy aukcje zaimportowane z Allegro z Twoimi ofertami: zmieniony tytuł i opis zaktualizujemy, a aukcje, których oferty
          już nie ma na Allegro, anulujemy. Aukcji z ofertami (licytacją) nie ruszamy.
        </p>
        <p className="muted">
          Aukcje, których oferta zakończyła się na Allegro (np. po sprzedaży), zamykamy też automatycznie, co około 30 minut.
        </p>
        {!working && (sync === 'idle' || sync === 'done') && (
          <div className="alg-actions">
            <button type="button" className="btn" disabled={activeCount === 0} onClick={() => void checkSync()}>
              Sprawdź zmiany
            </button>
            {activeCount === 0 && linked && <span className="muted">Nie masz aktywnych zaimportowanych aukcji.</span>}
          </div>
        )}
        {working && (
          <div className="alg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="alg-progress-track">
              <div className="alg-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span>
              {sync === 'fetching' ? 'Pobieramy oferty z Allegro' : sync === 'checking' ? 'Sprawdzamy oferty' : 'Zapisujemy zmiany'}
              … {progress.done} z {progress.total || '…'}
            </span>
          </div>
        )}
        {sync === 'ready' && plan && (
          <div className="alg-plan">
            {plan.update.length === 0 && plan.cancel.length === 0 && <p>Wszystko jest aktualne. Nie ma nic do zmiany.</p>}
            {plan.update.length > 0 && (
              <>
                <h3>Do zaktualizowania ({plan.update.length})</h3>
                <ul>
                  {plan.update.map((u) => (
                    <li key={u.auctionId}>
                      {u.oldTitle === u.title ? (
                        <>
                          {u.title}
                          <span className="muted"> (nowy opis)</span>
                        </>
                      ) : (
                        <>
                          {u.oldTitle} → <b>{u.title}</b>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {plan.cancel.length > 0 && (
              <>
                <h3>Do anulowania: nie ma już na Allegro ({plan.cancel.length})</h3>
                <ul>
                  {plan.cancel.map((c) => (
                    <li key={c.auctionId}>{c.title}</li>
                  ))}
                </ul>
              </>
            )}
            {plan.locked.length > 0 && (
              <>
                <h3>Bez zmian, bo mają oferty ({plan.locked.length})</h3>
                <ul>
                  {plan.locked.map((l) => (
                    <li key={l.auctionId}>
                      {l.title}
                      {l.gone && <span className="muted"> (oferty już nie ma na Allegro)</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {(plan.update.length > 0 || plan.cancel.length > 0) && (
              <div className="alg-plan-actions">
                {plan.cancel.length > 0 && !confirmCancel ? (
                  <button type="button" className="btn btn-primary" onClick={() => setConfirmCancel(true)}>
                    Zastosuj ({plan.update.length + plan.cancel.length})
                  </button>
                ) : plan.cancel.length > 0 ? (
                  <>
                    <p className="alg-warn">
                      Anulujemy {plan.cancel.length} {plan.cancel.length === 1 ? 'aukcję' : 'aukcji'}. Tego nie da się cofnąć.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={() => void applySync()}>
                      Tak, zastosuj
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmCancel(false)}>
                      Wróć
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => void applySync()}>
                    Zastosuj ({plan.update.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {syncMsg && <p className={`alg-note ${syncMsg.startsWith('Gotowe') ? 'is-ok' : 'is-err'}`}>{syncMsg}</p>}
      </section>

      <div className="imp-head">
        <h2>Zaimportowane aukcje{linked ? ` (${linked.length})` : ''}</h2>
        <label className="imp-filter">
          Pokaż
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter)
              setView(0)
            }}
          >
            <option value="all">Wszystkie</option>
            <option value="active">Aktywne</option>
            <option value="closed">Zakończone</option>
          </select>
        </label>
      </div>

      {linked && linked.length === 0 && (
        <div className="card-form">
          <p className="muted">Nie zaimportowałeś jeszcze żadnych aukcji z Allegro.</p>
          <Link className="btn btn-primary" to="/sell/import">
            Wybierz oferty do importu
          </Link>
        </div>
      )}

      {linked && linked.length > 0 && (
        <>
          <div className="imp-table-wrap">
            <table className="imp-table">
              <thead>
                <tr>
                  <th>Aukcja</th>
                  <th>Oferta Allegro</th>
                  <th>Status</th>
                  <th className="num">Oferty</th>
                  <th className="num">Cena</th>
                  <th>Koniec</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.auctionId}>
                    <td>
                      <Link to={`/auction/${l.auctionId}`} className="imp-title">
                        {l.imageUrl ? <img src={l.imageUrl} alt="" loading="lazy" /> : <span className="alg-noimg" />}
                        <span>{l.title}</span>
                      </Link>
                    </td>
                    <td>
                      <a href={`https://allegro.pl/oferta/${encodeURIComponent(l.offerId)}`} target="_blank" rel="noopener noreferrer">
                        {l.offerId}
                      </a>
                    </td>
                    <td>
                      <span className={`imp-status is-${l.status}`}>{STATUS_LABEL[l.status] ?? l.status}</span>
                      {l.endedOnAllegro && <span className="imp-note">oferta na Allegro zakończona</span>}
                    </td>
                    <td className="num">{l.bidCount}</td>
                    <td className="num">{l.currentPrice != null ? formatPln(l.currentPrice) : '—'}</td>
                    <td>{when(l.endsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="alg-pager" aria-label="Strony aukcji">
              <button type="button" className="btn" disabled={current === 0} onClick={() => setView(current - 1)}>
                ← Poprzednia
              </button>
              <span>
                Strona {current + 1} z {pages}
              </span>
              <button type="button" className="btn" disabled={current >= pages - 1} onClick={() => setView(current + 1)}>
                Następna →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
