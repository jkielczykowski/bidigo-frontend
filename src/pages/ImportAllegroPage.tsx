import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/bidigoApi'
import {
  allegroConnectUrl,
  allegroDisconnect,
  allegroOffers,
  allegroOffer,
  allegroStatus,
  type AllegroOffer,
  type AllegroStatus,
} from '../lib/allegroApi'
import { writeImportQueue } from '../lib/allegroQueue'
import { formatPln } from '../lib/format'
import { importedTexts, planSync, type LinkedListing, type OfferTexts, type SyncPlan } from '../lib/allegroSync'
import { myLinkedListings, syncCancel, syncUpdate } from '../lib/allegroSyncApi'

/** Offers fetched per request (the API allows 100) */
const PAGE = 50
/** Offers shown per page of the list */
const PER_VIEW = 20
/** Safety cap on one load-everything run */
const MAX_OFFERS = 2000

/** /sell/import: connect the seller's Allegro account, pick offers, then list them one by one in the usual form. */
export function ImportAllegroPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<AllegroStatus | null>(null)
  const [offers, setOffers] = useState<AllegroOffer[]>([])
  const [total, setTotal] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState(0)
  const [linked, setLinked] = useState<LinkedListing[]>([])
  const [sync, setSync] = useState<'idle' | 'checking' | 'ready' | 'applying' | 'done'>('idle')
  const [plan, setPlan] = useState<SyncPlan | null>(null)
  const [syncDone, setSyncDone] = useState({ done: 0, total: 0 })
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // a newer run (refresh, disconnect, leaving the page) makes the older loop stop
  const runRef = useRef(0)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  /** Fetches every page of offers one after another, showing them (and the progress) as they arrive. */
  const loadAll = useCallback(async () => {
    const run = ++runRef.current
    setBusy(true)
    setError(null)
    setOffers([])
    setTotal(0)
    setView(0)
    try {
      let offset = 0
      for (;;) {
        const page = await allegroOffers(offset, PAGE)
        if (run !== runRef.current) return
        setOffers((prev) => (offset === 0 ? page.offers : [...prev, ...page.offers]))
        setTotal(page.total)
        offset += page.offers.length
        if (page.offers.length === 0 || offset >= page.total || offset >= MAX_OFFERS) break
      }
    } catch (e) {
      if (run !== runRef.current) return
      if (e instanceof ApiError && e.status === 409) {
        // Allegro revoked the access: connect again
        setStatus((st) => (st ? { ...st, connected: false } : st))
      } else {
        setError('Nie udało się pobrać wszystkich ofert z Allegro. Spróbuj odświeżyć listę.')
      }
    } finally {
      if (run === runRef.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    const runs = runRef
    return () => {
      runs.current += 1
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void (async () => {
      try {
        const s = await allegroStatus()
        setStatus(s)
        if (s.connected) {
          void myLinkedListings().then(setLinked).catch(() => setLinked([]))
          await loadAll()
        }
      } catch {
        setError('Nie udało się sprawdzić połączenia z Allegro.')
      }
    })()
  }, [user, loadAll])

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      window.location.assign(await allegroConnectUrl())
    } catch {
      setError('Nie udało się połączyć z Allegro.')
      setBusy(false)
    }
  }

  async function disconnect() {
    runRef.current += 1
    setBusy(true)
    try {
      await allegroDisconnect()
      setStatus((s) => (s ? { ...s, connected: false, login: undefined } : s))
      setOffers([])
      setTotal(0)
      setPicked(new Set())
      // the ?allegro=connected notice of this visit no longer applies
      setParams({}, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function refresh() {
    setPicked(new Set())
    setSync('idle')
    setPlan(null)
    setSyncMsg(null)
    void loadAll()
    void myLinkedListings().then(setLinked).catch(() => undefined)
  }

  // offers already on Bidigo (an active or draft listing) are not imported a second time
  const onBidigo = new Set(linked.filter((l) => l.status === 'active' || l.status === 'draft').map((l) => l.offerId))
  const selectable = offers.filter((o) => !onBidigo.has(o.id))
  // the whole list arrived: only then may a missing offer mean "gone from Allegro"
  const complete = !busy && !error && total > 0 && offers.length === total

  function toggleAll() {
    setPicked((prev) => (prev.size === selectable.length ? new Set() : new Set(selectable.map((o) => o.id))))
  }

  /** Compares the linked listings with Allegro: fetches the current text of the offers that may still change. */
  async function checkSync() {
    setSync('checking')
    setSyncMsg(null)
    setConfirmCancel(false)
    try {
      const fresh = await myLinkedListings()
      setLinked(fresh)
      const present = new Set(offers.map((o) => o.id))
      const texts = new Map<string, OfferTexts>()
      const todo = fresh.filter((l) => l.status === 'active' && l.bidCount === 0 && present.has(l.offerId))
      setSyncDone({ done: 0, total: todo.length })
      for (const [i, l] of todo.entries()) {
        try {
          texts.set(l.offerId, importedTexts(await allegroOffer(l.offerId)))
        } catch {
          // this one is skipped; the rest still compare
        }
        setSyncDone({ done: i + 1, total: todo.length })
      }
      setPlan(planSync(fresh, present, complete, texts))
      setSync('ready')
    } catch {
      setSyncMsg('Nie udało się sprawdzić zmian. Spróbuj ponownie.')
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
    setSyncDone({ done: 0, total: jobs.length })
    let failed = 0
    for (const [i, job] of jobs.entries()) {
      try {
        await job()
      } catch {
        failed += 1
      }
      setSyncDone({ done: i + 1, total: jobs.length })
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

  function start() {
    writeImportQueue({ ids: selectable.filter((o) => picked.has(o.id)).map((o) => o.id), pos: 0 })
    navigate('/sell?import=1')
  }

  if (loading || !user) {
    return (
      <div className="container narrow page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  const result = params.get('allegro')
  const pages = Math.max(1, Math.ceil(offers.length / PER_VIEW))
  const current = Math.min(view, pages - 1)
  const shown = offers.slice(current * PER_VIEW, (current + 1) * PER_VIEW)
  const pct = total > 0 ? Math.round((offers.length / total) * 100) : 0

  return (
    <div className="container narrow page alg">
      <h1>Import z Allegro</h1>
      <p className="muted">
        Przenieś swoje oferty z Allegro na Bidigo. Pobieramy tytuł, opis, cenę i zdjęcia, a Ty sprawdzasz każdą
        aukcję przed wystawieniem — wybierasz kategorię, miasto i dostawę.
      </p>

      {result === 'connected' && status?.connected && <p className="alg-note is-ok">Połączono z Allegro. Wybierz oferty do zaimportowania.</p>}
      {result === 'error' && (
        <p className="alg-note is-err">Nie udało się połączyć z Allegro. Spróbuj jeszcze raz.</p>
      )}
      {error && <p className="alg-note is-err">{error}</p>}

      {status && !status.configured && (
        <div className="card-form">
          <h2>Import będzie dostępny wkrótce</h2>
          <p className="muted">Pracujemy nad połączeniem z Allegro. Do tego czasu możesz wystawić aukcję ręcznie.</p>
          <Link className="btn btn-primary" to="/sell">
            Wystaw aukcję
          </Link>
        </div>
      )}

      {status?.configured && !status.connected && (
        <div className="card-form alg-connect">
          <h2>Połącz konto Allegro</h2>
          <ul className="alg-points">
            <li>Przekierujemy Cię do Allegro, gdzie zgadzasz się na odczyt swoich ofert.</li>
            <li>Nie widzimy Twojego hasła i niczego nie zmieniamy na Allegro.</li>
            <li>Połączenie możesz w każdej chwili odłączyć.</li>
          </ul>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void connect()}>
            {busy ? 'Łączenie…' : 'Połącz z Allegro'}
          </button>
        </div>
      )}

      {status?.connected && (
        <>
          <div className="alg-bar">
            <span>
              Połączono{status.login ? <> jako <b>{status.login}</b></> : null}
            </span>
            <span className="alg-bar-actions">
              <button type="button" className="link-btn" disabled={busy} onClick={refresh}>
                Odśwież listę
              </button>
              <button type="button" className="link-btn" disabled={busy} onClick={() => void disconnect()}>
                Odłącz
              </button>
            </span>
          </div>

          {busy && (
            <div className="alg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="alg-progress-track">
                <div className="alg-progress-fill" style={{ width: `${Math.max(pct, 4)}%` }} />
              </div>
              <span>{total > 0 ? `Pobieramy oferty z Allegro… ${offers.length} z ${total}` : 'Pobieramy oferty z Allegro…'}</span>
            </div>
          )}

          {selectable.length > 1 && !busy && (
            <button type="button" className="link-btn" onClick={toggleAll}>
              {picked.size === selectable.length ? 'Odznacz wszystkie' : `Zaznacz wszystkie (${selectable.length})`}
            </button>
          )}

          {!busy && offers.length === 0 && <p className="muted">Nie znaleźliśmy aktywnych ofert na Twoim koncie Allegro.</p>}

          <ul className="alg-list">
            {shown.map((o) => (
              <li key={o.id}>
                <label className={`alg-item${picked.has(o.id) ? ' is-picked' : ''}${onBidigo.has(o.id) ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={picked.has(o.id)}
                    disabled={onBidigo.has(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                  {o.imageUrl ? <img src={o.imageUrl} alt="" loading="lazy" /> : <span className="alg-noimg" />}
                  <span className="alg-title">
                    {o.title}
                    {onBidigo.has(o.id) && <em className="alg-badge">Już na Bidigo</em>}
                  </span>
                  <b>{o.price != null ? formatPln(o.price) : ''}</b>
                </label>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav className="alg-pager" aria-label="Strony ofert">
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

          {linked.some((l) => l.status === 'active') && (
            <section className="alg-sync">
              <h2>Synchronizacja z Allegro</h2>
              <p className="muted">
                Porównamy aukcje zaimportowane z Allegro z Twoimi ofertami: zmieniony tytuł i opis zaktualizujemy, a aukcje,
                których oferty już nie ma na Allegro, anulujemy. Aukcji z ofertami (licytacją) nie ruszamy.
              </p>
              {sync === 'idle' || sync === 'done' ? (
                <button type="button" className="btn" disabled={!complete} onClick={() => void checkSync()}>
                  Sprawdź zmiany
                </button>
              ) : null}
              {!complete && !busy && sync === 'idle' && (
                <p className="muted">Synchronizacja jest dostępna po pobraniu wszystkich ofert z Allegro. Odśwież listę.</p>
              )}
              {(sync === 'checking' || sync === 'applying') && (
                <div className="alg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={syncDone.total} aria-valuenow={syncDone.done}>
                  <div className="alg-progress-track">
                    <div
                      className="alg-progress-fill"
                      style={{ width: `${syncDone.total ? Math.max(4, Math.round((syncDone.done / syncDone.total) * 100)) : 4}%` }}
                    />
                  </div>
                  <span>
                    {sync === 'checking' ? 'Sprawdzamy oferty' : 'Zapisujemy zmiany'}… {syncDone.done} z {syncDone.total}
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
                            {u.oldTitle === u.title ? u.title : <>{u.oldTitle} → <b>{u.title}</b></>}
                            {u.oldTitle === u.title && <span className="muted"> (nowy opis)</span>}
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
              {syncMsg && <p className="alg-note is-ok">{syncMsg}</p>}
            </section>
          )}

          <div className="alg-cta">
            <button type="button" className="btn btn-primary" disabled={picked.size === 0} onClick={start}>
              {picked.size === 0 ? 'Wybierz oferty' : `Importuj wybrane (${picked.size})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
