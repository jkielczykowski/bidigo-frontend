import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CitySuggest } from '../components/CitySuggest'
import { FeeBlockBanner } from '../components/FeeBlockBanner'
import { useAuth } from '../lib/auth'
import { allegroOffer } from '../lib/allegroApi'
import {
  DEFAULT_BULK,
  defaultsProblems,
  leafOptions,
  makeRow,
  repriced,
  rowProblems,
  type BulkDefaults,
  type BulkRow,
} from '../lib/allegroBulk'
import { createListing } from '../lib/allegroBulkApi'
import { readImportQueue, writeImportQueue } from '../lib/allegroQueue'
import { geocodeCity } from '../lib/cities'
import type { Category } from '../lib/database.types'
import { errorMessage } from '../lib/errors'
import { isFeeBlockError, useFeeBlock } from '../lib/feeBlock'
import { formatPln } from '../lib/format'
import { supabase } from '../lib/supabase'

type Status = { state: 'idle' | 'working' | 'done' | 'error'; message?: string; auctionId?: string }

const SHIPPING: [string, string][] = [
  ['odbior', 'Odbiór osobisty'],
  ['inpost', 'InPost'],
  ['kurier', 'Kurier'],
]

/** /sell/import/review: every picked offer in one table, shared settings on top, one button to list them all. */
export function ImportReviewPage() {
  const { user, profile, loading } = useAuth()
  const { block: feeBlock, reload: reloadFeeBlock } = useFeeBlock()
  const navigate = useNavigate()
  const [ids] = useState<string[]>(() => readImportQueue()?.ids ?? [])
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<BulkRow[]>([])
  const [failedToLoad, setFailedToLoad] = useState<string[]>([])
  const [loaded, setLoaded] = useState(0)
  const [d, setD] = useState<BulkDefaults>(DEFAULT_BULK)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [phase, setPhase] = useState<'loading' | 'edit' | 'importing' | 'done'>('loading')
  const [note, setNote] = useState<string | null>(null)
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
    void supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories((data as Category[]) ?? []))
  }, [])

  const options = useMemo(() => leafOptions(categories), [categories])
  const leafIds = useMemo(() => new Set(options.map((o) => o.id)), [options])

  // Details of every picked offer (text, photos, Allegro category path), one after another with progress
  useEffect(() => {
    if (!user || categories.length === 0 || ids.length === 0) return
    void (async () => {
      const made: BulkRow[] = []
      const failed: string[] = []
      for (const [i, id] of ids.entries()) {
        try {
          made.push(makeRow(await allegroOffer(id), categories, DEFAULT_BULK))
        } catch {
          failed.push(id)
        }
        if (!alive.current) return
        setRows([...made])
        setFailedToLoad([...failed])
        setLoaded(i + 1)
      }
      if (alive.current) setPhase('edit')
    })()
  }, [user, categories, ids])

  function patch(offerId: string, change: Partial<BulkRow>) {
    setRows((prev) => prev.map((r) => (r.offerId === offerId ? { ...r, ...change } : r)))
  }

  function setShipping(opt: string) {
    setD((prev) => ({
      ...prev,
      shipping: prev.shipping.includes(opt) ? prev.shipping.filter((x) => x !== opt) : [...prev.shipping, opt],
    }))
  }

  function applyPrices() {
    setRows((prev) => prev.map((r) => repriced(r, d)))
  }

  const included = rows.filter((r) => r.include)
  const problems = defaultsProblems(d)
  const rowsWithProblems = included.filter((r) => rowProblems(r, leafIds).length > 0)
  const pending = included.filter((r) => status[r.offerId]?.state !== 'done')
  const doneCount = Object.values(status).filter((s) => s.state === 'done').length
  const failedCount = Object.values(status).filter((s) => s.state === 'error').length
  const ready = problems.length === 0 && rowsWithProblems.length === 0 && pending.length > 0 && !feeBlock?.blocked

  async function startImport() {
    if (!user) return
    let place = { lat: d.lat, lng: d.lng }
    if ((place.lat == null || place.lng == null) && d.city.trim().length >= 2) {
      const g = await geocodeCity(d.city.trim())
      if (g) place = { lat: g.lat, lng: g.lng }
    }
    const defaults = { ...d, ...place }
    if (defaultsProblems(defaults).length > 0) {
      setNote('Wybierz miasto z listy, żeby ustawić lokalizację.')
      return
    }
    setD(defaults)
    setNote(null)
    setPhase('importing')
    for (const row of pending) {
      if (!alive.current) return
      setStatus((s) => ({ ...s, [row.offerId]: { state: 'working' } }))
      try {
        const auctionId = await createListing(user.id, row, defaults)
        setStatus((s) => ({ ...s, [row.offerId]: { state: 'done', auctionId } }))
      } catch (err) {
        setStatus((s) => ({ ...s, [row.offerId]: { state: 'error', message: errorMessage(err, 'Nie udało się wystawić') } }))
        if (isFeeBlockError(err)) {
          void reloadFeeBlock()
          setNote('Masz zaległe opłaty: wystawianie jest zablokowane. Przerwaliśmy import.')
          break
        }
      }
    }
    if (!alive.current) return
    writeImportQueue(null)
    setPhase('done')
  }

  if (loading || !user) {
    return (
      <div className="container page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  if (!profile?.phone_verified_at) {
    return (
      <div className="container narrow page">
        <h1>Potwierdź telefon</h1>
        <p className="muted">Żeby wystawiać aukcje, potwierdź numer telefonu kodem SMS.</p>
        <Link className="btn btn-primary" to="/verify-phone?next=/sell/import">
          Potwierdź numer SMS
        </Link>
      </div>
    )
  }

  if (ids.length === 0) {
    return (
      <div className="container narrow page">
        <h1>Import z Allegro</h1>
        <p className="muted">Nie wybrano żadnych ofert.</p>
        <Link className="btn btn-primary" to="/sell/import">
          Wybierz oferty
        </Link>
      </div>
    )
  }

  const busyPhase = phase === 'importing'
  const progressPct = ids.length ? Math.round((loaded / ids.length) * 100) : 0
  const importPct = included.length ? Math.round(((doneCount + failedCount) / included.length) * 100) : 0

  return (
    <div className="container page bulk">
      <Link to="/sell/import" className="my-back-link">
        ← Wybór ofert
      </Link>
      <h1>Import z Allegro: {ids.length} {ids.length === 1 ? 'oferta' : 'ofert'}</h1>
      <p className="muted">
        Ustaw wspólne dane dla wszystkich aukcji, sprawdź kategorie dopasowane automatycznie i popraw te, które nie pasują.
        Cenę startową ustawiliśmy jako część ceny z Allegro.
      </p>

      <FeeBlockBanner block={feeBlock} showDueSoon />

      {phase === 'loading' && (
        <div className="alg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
          <div className="alg-progress-track">
            <div className="alg-progress-fill" style={{ width: `${Math.max(progressPct, 4)}%` }} />
          </div>
          <span>
            Pobieramy oferty i dopasowujemy kategorie… {loaded} z {ids.length}
          </span>
        </div>
      )}

      <section className="bulk-defaults">
        <h2>Ustawienia dla wszystkich</h2>
        <div className="bulk-defaults-grid">
          <CitySuggest
            value={d.city}
            label="Miasto"
            placeholder="Wpisz i wybierz z listy…"
            onChange={(city) => setD((p) => ({ ...p, city, lat: null, lng: null }))}
            onPlaceSelect={(place) => setD((p) => ({ ...p, lat: place?.lat ?? null, lng: place?.lng ?? null }))}
          />
          <fieldset className="bulk-field">
            <legend>Odbiór / wysyłka</legend>
            {SHIPPING.map(([id, label]) => (
              <label key={id} className="checkbox">
                <input type="checkbox" checked={d.shipping.includes(id)} onChange={() => setShipping(id)} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="bulk-field">
            <span className="label-text">Czas trwania</span>
            <select value={d.durationDays} onChange={(e) => setD((p) => ({ ...p, durationDays: Number(e.target.value) === 14 ? 14 : 7 }))}>
              <option value={7}>7 dni</option>
              <option value={14}>14 dni</option>
            </select>
            <label className="checkbox">
              <input type="checkbox" checked={d.autoRenew} onChange={(e) => setD((p) => ({ ...p, autoRenew: e.target.checked }))} />
              Wystaw ponownie, jeśli nie sprzedana
            </label>
          </label>
          <div className="bulk-field">
            <span className="label-text">Ceny z Allegro</span>
            <div className="bulk-pct">
              <span>Cena startowa</span>
              <span className="bulk-pct-in">
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  aria-label="Cena startowa jako procent ceny z Allegro"
                  value={d.startPercent}
                  onChange={(e) => setD((p) => ({ ...p, startPercent: Number(e.target.value) || 50 }))}
                />
                <span>% ceny z Allegro</span>
              </span>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={d.withBuyNow} onChange={(e) => setD((p) => ({ ...p, withBuyNow: e.target.checked }))} />
              „Kup teraz” = cena z Allegro
            </label>
            <button type="button" className="btn btn-sm" disabled={busyPhase} onClick={applyPrices}>
              Przelicz ceny wszystkich
            </button>
          </div>
        </div>
        {problems.length > 0 && phase !== 'loading' && <p className="alg-warn">Uzupełnij: {problems.join(', ')}.</p>}
      </section>

      {failedToLoad.length > 0 && (
        <p className="alg-note is-err">
          Nie udało się pobrać {failedToLoad.length} {failedToLoad.length === 1 ? 'oferty' : 'ofert'} z Allegro. Wróć do wyboru i spróbuj ponownie.
        </p>
      )}

      <div className="bulk-table" role="table" aria-label="Oferty do importu">
        {rows.map((r) => {
          const st = status[r.offerId]
          const issues = rowProblems(r, leafIds)
          return (
            <div key={r.offerId} role="row" className={`bulk-row${r.include ? '' : ' is-off'}${st ? ` is-${st.state}` : ''}`}>
              <input
                type="checkbox"
                aria-label="Importuj"
                checked={r.include}
                disabled={busyPhase || st?.state === 'done'}
                onChange={(e) => patch(r.offerId, { include: e.target.checked })}
              />
              {r.imageUrls[0] ? <img src={r.imageUrls[0]} alt="" loading="lazy" /> : <span className="alg-noimg" />}
              <div className="bulk-main">
                <input
                  className="bulk-title"
                  value={r.title}
                  maxLength={120}
                  disabled={busyPhase || st?.state === 'done'}
                  onChange={(e) => patch(r.offerId, { title: e.target.value })}
                />
                <select
                  className={`bulk-cat${leafIds.has(r.categoryId) ? '' : ' is-missing'}`}
                  value={r.categoryId}
                  disabled={busyPhase || st?.state === 'done'}
                  onChange={(e) => patch(r.offerId, { categoryId: e.target.value, guessed: false })}
                >
                  <option value="">— wybierz kategorię —</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {r.allegroPath.length > 0 && (
                  <span className="bulk-path muted">
                    Allegro: {r.allegroPath.join(' › ')}
                    {r.guessed && <em className="alg-badge">dopasowano automatycznie</em>}
                  </span>
                )}
              </div>
              <label className="bulk-price">
                <span>Start (zł)</span>
                <input
                  type="number"
                  min={1}
                  value={r.start}
                  disabled={busyPhase || st?.state === 'done'}
                  onChange={(e) => patch(r.offerId, { start: e.target.value })}
                />
              </label>
              <label className="bulk-price">
                <span>Kup teraz (zł)</span>
                <input
                  type="number"
                  min={1}
                  value={r.buyNow}
                  disabled={busyPhase || st?.state === 'done'}
                  onChange={(e) => patch(r.offerId, { buyNow: e.target.value })}
                />
              </label>
              <div className="bulk-state">
                {st?.state === 'working' && <span className="muted">Wystawiamy…</span>}
                {st?.state === 'done' && st.auctionId && (
                  <Link to={`/auction/${st.auctionId}`} target="_blank">
                    Wystawiona ✓
                  </Link>
                )}
                {st?.state === 'error' && <span className="alg-warn">{st.message}</span>}
                {!st && r.include && issues.length > 0 && <span className="alg-warn">Brak: {issues.join(', ')}</span>}
                {!st && r.allegroPrice != null && <span className="muted">Allegro: {formatPln(r.allegroPrice)}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {note && <p className="alg-note is-err">{note}</p>}

      {busyPhase && (
        <div className="alg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={importPct}>
          <div className="alg-progress-track">
            <div className="alg-progress-fill" style={{ width: `${Math.max(importPct, 4)}%` }} />
          </div>
          <span>
            Wystawiamy aukcje… {doneCount + failedCount} z {included.length}
          </span>
        </div>
      )}

      {phase === 'done' && (
        <p className={`alg-note ${failedCount > 0 ? 'is-err' : 'is-ok'}`}>
          Wystawiono {doneCount} z {included.length}.
          {failedCount > 0 ? ` Nie udało się: ${failedCount}. Popraw je w tabeli i kliknij „Ponów”.` : ' Aukcje przechodzą teraz automatyczną weryfikację.'}
        </p>
      )}

      <div className="alg-cta bulk-cta">
        {(phase === 'edit' || phase === 'done') && pending.length > 0 && (
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => void startImport()}>
            {failedCount > 0 ? `Ponów (${pending.length})` : `Wystaw ${pending.length} ${pending.length === 1 ? 'aukcję' : 'aukcji'}`}
          </button>
        )}
        {phase === 'done' && doneCount > 0 && (
          <>
            <Link className="btn" to="/sell/import/imported">
              Zaimportowane
            </Link>
            <Link className="btn" to="/my/selling">
              Moje aukcje
            </Link>
          </>
        )}
        {phase === 'edit' && !ready && (
          <span className="muted">
            {problems.length > 0
              ? 'Uzupełnij ustawienia dla wszystkich.'
              : rowsWithProblems.length > 0
                ? `Do poprawy: ${rowsWithProblems.length} (zaznaczone wiersze z brakami).`
                : ''}
          </span>
        )}
      </div>
    </div>
  )
}
