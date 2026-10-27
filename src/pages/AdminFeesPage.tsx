import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminShell, StateBadge } from '../components/AdminShell'
import { Pagination } from '../components/Pagination'
import {
  adminFees,
  adminSettlements,
  adminUserDetail,
  formatDate,
  PAGE_SIZE,
  plural,
  REASON_LABEL,
  STATE_LABEL,
  type AdminFee,
  type AdminPage,
  type AdminSettlement,
  type FeeFilters,
  type FeeState,
} from '../lib/adminApi'
import { formatPln } from '../lib/format'

const STATES: { id: FeeState | null; label: string }[] = [
  { id: null, label: 'Wszystkie' },
  { id: 'paid', label: 'Opłacone' },
  { id: 'pending', label: 'Do zapłaty' },
  { id: 'overdue', label: 'Zaległe' },
  { id: 'cancelled', label: 'Anulowane' },
]

type View = 'prowizje' | 'rozliczenia'

function SellerCell({ id, name, email }: { id: string; name: string | null; email: string | null }) {
  return (
    <td>
      <Link to={`/admin/users/${id}`}>{name || 'Bez nazwy'}</Link>
      <div className="admin-cell-sub">{email}</div>
    </td>
  )
}

function FeesTable({ items }: { items: AdminFee[] }) {
  return (
    <table data-testid="admin-fees">
      <thead>
        <tr>
          <th>Aukcja</th>
          <th>Sprzedawca</th>
          <th>Status</th>
          <th className="num">Prowizja</th>
          <th>Sprzedaż</th>
          <th>Rozliczenie / płatność</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={6} className="admin-empty">
              Brak prowizji pasujących do filtrów.
            </td>
          </tr>
        )}
        {items.map((f) => (
          <tr key={f.id} data-fee={f.id}>
            <td>
              <Link to={`/auction/${f.auction_id}`} className="admin-cell-title">
                {f.auction_title || '—'}
              </Link>
              <div className="admin-cell-sub">
                {formatPln(f.sale_price)} × {f.fee_percent}%
              </div>
            </td>
            <SellerCell id={f.seller_id} name={f.seller_name} email={f.seller_email} />
            <td>
              <StateBadge state={f.state} label={STATE_LABEL[f.state]} />
              {f.state !== 'paid' && f.due_at && <div className="admin-cell-sub">termin {formatDate(f.due_at)}</div>}
            </td>
            <td className="num">{formatPln(f.fee_amount)}</td>
            <td>{formatDate(f.created_at)}</td>
            <td>
              <div>{f.settlement_number || (f.state === 'pending' ? 'Czeka na rozliczenie' : '—')}</div>
              {f.payment_intent_id && <div className="admin-mono">{f.payment_intent_id}</div>}
              {f.paid_at && <div className="admin-cell-sub">zapłacono {formatDate(f.paid_at, true)}</div>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SettlementsTable({ items }: { items: AdminSettlement[] }) {
  return (
    <table data-testid="admin-settlements">
      <thead>
        <tr>
          <th>Rozliczenie</th>
          <th>Sprzedawca</th>
          <th>Status</th>
          <th className="num">Kwota</th>
          <th>Wystawione</th>
          <th>Termin / zapłacono</th>
          <th>Płatność Stripe</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={7} className="admin-empty">
              Brak rozliczeń pasujących do filtrów.
            </td>
          </tr>
        )}
        {items.map((s) => (
          <tr key={s.id} data-settlement={s.number}>
            <td>
              <div className="admin-cell-title">{s.number}</div>
              <div className="admin-cell-sub">
                {REASON_LABEL[s.reason]} · {plural(s.fee_count, 'prowizja', 'prowizje', 'prowizji')}
              </div>
            </td>
            <SellerCell id={s.seller_id} name={s.seller_name} email={s.seller_email} />
            <td>
              <StateBadge state={s.state} label={STATE_LABEL[s.state]} />
            </td>
            <td className="num">{formatPln(s.amount)}</td>
            <td>{formatDate(s.issued_at)}</td>
            <td>{s.paid_at ? formatDate(s.paid_at, true) : formatDate(s.due_at)}</td>
            <td className="admin-mono">{s.payment_intent_id || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AdminFeesPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('widok') === 'rozliczenia' ? 'rozliczenia' : 'prowizje'
  const state = (STATES.find((s) => s.id === params.get('status'))?.id ?? null) as FeeState | null
  const from = params.get('od') || ''
  const to = params.get('do') || ''
  const userId = params.get('uzytkownik')
  const query = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('strona')) || 1)

  const [draft, setDraft] = useState(query)
  // Rows remember their view, so switching tabs never renders fees in the settlements table
  const [data, setData] = useState<(AdminPage<AdminFee | AdminSettlement> & { view: View }) | null>(null)
  const [userLabel, setUserLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(query), [query])

  useEffect(() => {
    if (draft === query) return
    const t = window.setTimeout(() => setParam('q', draft.trim() || null), 300)
    return () => window.clearTimeout(t)
  })

  useEffect(() => {
    let alive = true
    setError(null)
    const filters: FeeFilters = { state, from, to, userId, query }
    const load = view === 'rozliczenia' ? adminSettlements(filters, page) : adminFees(filters, page)
    load.then((d) => alive && setData({ ...d, view })).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [view, state, from, to, userId, query, page])

  useEffect(() => {
    if (!userId) return setUserLabel(null)
    let alive = true
    adminUserDetail(userId)
      .then((u) => alive && setUserLabel(u ? u.display_name || u.username || u.email : null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [userId])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'strona') next.delete('strona')
    setParams(next, { replace: key !== 'strona' })
  }

  const filtered = !!(state || from || to || userId || query)

  return (
    <AdminShell
      title="Opłaty"
      subtitle="Prowizje od sprzedaży i rozliczenia zbiorcze (jedna płatność Stripe za wiele prowizji)"
      actions={
        <div className="admin-chips" role="group" aria-label="Widok">
          <button type="button" className="admin-chip" aria-pressed={view === 'prowizje'} onClick={() => setParam('widok', null)}>
            Prowizje
          </button>
          <button
            type="button"
            className="admin-chip"
            aria-pressed={view === 'rozliczenia'}
            onClick={() => setParam('widok', 'rozliczenia')}
          >
            Rozliczenia
          </button>
        </div>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="admin-card flush">
        <div className="admin-toolbar">
          <div className="admin-chips" role="group" aria-label="Status">
            {STATES.map((s) => (
              <button
                key={s.label}
                type="button"
                className="admin-chip"
                aria-pressed={s.id === state}
                onClick={() => setParam('status', s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="admin-toolbar-row">
            <div className="admin-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                aria-label="Szukaj opłat"
                placeholder={
                  view === 'rozliczenia'
                    ? 'Szukaj: numer RP/…, sprzedawca, e-mail, pi_…'
                    : 'Szukaj: aukcja, sprzedawca, e-mail, numer RP/…, pi_…'
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <label className="admin-date">
              {view === 'rozliczenia' ? 'Wystawione od' : 'Sprzedaż od'}
              <input type="date" value={from} max={to || undefined} onChange={(e) => setParam('od', e.target.value || null)} />
            </label>
            <label className="admin-date">
              do
              <input type="date" value={to} min={from || undefined} onChange={(e) => setParam('do', e.target.value || null)} />
            </label>
            {userId && (
              <span className="admin-filter-tag">
                Użytkownik: {userLabel ?? '…'}
                <button type="button" aria-label="Usuń filtr użytkownika" onClick={() => setParam('uzytkownik', null)}>
                  ×
                </button>
              </span>
            )}
            {filtered && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setParams(view === 'rozliczenia' ? { widok: 'rozliczenia' } : {}, { replace: true })}
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>
        <div className="admin-table-wrap">
          {data &&
            (data.view === 'rozliczenia' ? (
              <SettlementsTable items={data.items as AdminSettlement[]} />
            ) : (
              <FeesTable items={data.items as AdminFee[]} />
            ))}
        </div>
        {data && (
          <div className="admin-table-foot">
            <span data-testid="admin-fees-total">
              {data.view === 'rozliczenia'
                ? plural(data.total, 'rozliczenie', 'rozliczenia', 'rozliczeń')
                : plural(data.total, 'prowizja', 'prowizje', 'prowizji')}{' '}
              na {formatPln(data.total_amount ?? 0)}
            </span>
            {data.total > PAGE_SIZE && (
              <Pagination
                page={page}
                pageCount={Math.ceil(data.total / PAGE_SIZE)}
                onChange={(p) => setParam('strona', p > 1 ? String(p) : null)}
              />
            )}
          </div>
        )}
      </div>
    </AdminShell>
  )
}
