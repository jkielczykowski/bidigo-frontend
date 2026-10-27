import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminShell, StateBadge } from '../components/AdminShell'
import { Pagination } from '../components/Pagination'
import {
  adminUserDetail,
  adminUsers,
  formatDate,
  PAGE_SIZE,
  plural,
  REASON_LABEL,
  STATE_LABEL,
  userName,
  type AdminPage,
  type AdminUser,
  type AdminUserDetail,
} from '../lib/adminApi'
import { formatPln } from '../lib/format'

const AUCTION_STATUS: Record<string, string> = {
  draft: 'Szkic',
  active: 'Aktywna',
  ended: 'Zakończona',
  sold: 'Sprzedana',
  cancelled: 'Anulowana',
}

function UserBadges({ u }: { u: Pick<AdminUser, 'blocked' | 'phone_verified' | 'is_admin'> }) {
  return (
    <>
      {u.blocked && <StateBadge state="blocked" label="Zablokowany" />}{' '}
      {u.phone_verified ? (
        <StateBadge state="ok" label="Tel. zweryfikowany" />
      ) : (
        <StateBadge state="none" label="Tel. niezweryfikowany" />
      )}
      {u.is_admin && (
        <>
          {' '}
          <StateBadge state="info" label="Admin" />
        </>
      )}
    </>
  )
}

function UserDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    let alive = true
    setUser(null)
    adminUserDetail(id)
      .then((u) => {
        if (!alive) return
        if (u) setUser(u)
        else setError('Nie ma takiego użytkownika.')
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id])

  return (
    <dialog
      ref={ref}
      className="admin-drawer"
      aria-label="Szczegóły użytkownika"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="admin-drawer-head">
        <div>
          <h2>
            {user ? userName(user) : 'Użytkownik'}
            {user && <UserBadges u={user} />}
          </h2>
          {user && <p className="admin-muted">@{user.username} · konto od {formatDate(user.created_at)}</p>}
        </div>
        <button type="button" className="admin-x" aria-label="Zamknij" onClick={() => ref.current?.close()}>
          ×
        </button>
      </div>
      <div className="admin-drawer-body">
        {error && <p className="error">{error}</p>}
        {!user && !error && <p className="admin-muted">Ładowanie…</p>}
        {user && (
          <>
            <div className="admin-mini-stats">
              <div className="admin-stat ok">
                <div className="label">Opłacone</div>
                <div className="value">{formatPln(user.paid_amount)}</div>
              </div>
              <div className="admin-stat warn">
                <div className="label">Do zapłaty</div>
                <div className="value">{formatPln(user.pending_amount)}</div>
              </div>
              <div className="admin-stat bad">
                <div className="label">Zaległe</div>
                <div className="value">{formatPln(user.overdue_amount)}</div>
              </div>
            </div>

            <section className="admin-sec">
              <h3>Kontakt</h3>
              <dl>
                <dt>E-mail</dt>
                <dd>{user.email || '—'}</dd>
                <dt>Telefon</dt>
                <dd>
                  {user.phone || '—'}
                  {user.phone_verified_at && (
                    <span className="admin-cell-sub"> · zweryfikowany {formatDate(user.phone_verified_at)}</span>
                  )}
                </dd>
                <dt>Miasto</dt>
                <dd>{user.city || '—'}</dd>
                <dt>Ostatnie logowanie</dt>
                <dd>{formatDate(user.last_sign_in_at, true)}</dd>
                <dt>Oceny</dt>
                <dd>{user.rating_count > 0 ? `${user.rating_avg} (${user.rating_count})` : 'Brak'}</dd>
              </dl>
            </section>

            <section className="admin-sec">
              <h3>Rozliczenia ({user.settlements.length})</h3>
              {user.settlements.length === 0 ? (
                <p className="admin-muted">Brak rozliczeń.</p>
              ) : (
                <div className="admin-box admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Numer</th>
                        <th>Status</th>
                        <th className="num">Kwota</th>
                        <th>Termin / zapłacono</th>
                        <th>Płatność Stripe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.settlements.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="admin-cell-title">{s.number}</div>
                            <div className="admin-cell-sub">
                              {REASON_LABEL[s.reason]} · {plural(s.fee_count, 'prowizja', 'prowizje', 'prowizji')}
                            </div>
                          </td>
                          <td>
                            <StateBadge state={s.state} label={STATE_LABEL[s.state]} />
                          </td>
                          <td className="num">{formatPln(s.amount)}</td>
                          <td>{s.paid_at ? formatDate(s.paid_at, true) : formatDate(s.due_at)}</td>
                          <td className="admin-mono">{s.payment_intent_id || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="admin-sec">
              <h3>
                Prowizje ({user.fees.length}){' '}
                <Link to={`/admin/fees?uzytkownik=${user.id}`} style={{ textTransform: 'none', letterSpacing: 0 }}>
                  w widoku opłat →
                </Link>
              </h3>
              {user.fees.length === 0 ? (
                <p className="admin-muted">Brak prowizji.</p>
              ) : (
                <div className="admin-box admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Aukcja</th>
                        <th>Status</th>
                        <th className="num">Prowizja</th>
                        <th>Sprzedaż</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.fees.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <div className="admin-cell-title">{f.auction_title || '—'}</div>
                            <div className="admin-cell-sub">
                              {formatPln(f.sale_price)} × {f.fee_percent}%
                              {f.settlement_number ? ` · ${f.settlement_number}` : ''}
                            </div>
                          </td>
                          <td>
                            <StateBadge state={f.state} label={STATE_LABEL[f.state]} />
                          </td>
                          <td className="num">{formatPln(f.fee_amount)}</td>
                          <td>{formatDate(f.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="admin-sec">
              <h3>Aukcje ({user.auction_count})</h3>
              {user.auctions.length === 0 ? (
                <p className="admin-muted">Brak aukcji.</p>
              ) : (
                <div className="admin-box admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tytuł</th>
                        <th>Status</th>
                        <th className="num">Cena</th>
                        <th>Wystawiona</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.auctions.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <Link to={`/auction/${a.id}`} className="admin-cell-title">
                              {a.title}
                            </Link>
                            <div className="admin-cell-sub">
                              {plural(a.bid_count, 'oferta', 'oferty', 'ofert')}
                              {a.moderation_status !== 'approved' ? ` · moderacja: ${a.moderation_status}` : ''}
                            </div>
                          </td>
                          <td>{AUCTION_STATUS[a.status] ?? a.status}</td>
                          <td className="num">{formatPln(a.current_price)}</td>
                          <td>{formatDate(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </dialog>
  )
}

export function AdminUsersPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const blocked = params.get('blokada') === '1'
  const page = Math.max(1, Number(params.get('strona')) || 1)
  const [draft, setDraft] = useState(query)
  const [data, setData] = useState<AdminPage<AdminUser> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(query), [query])

  // Search as you type, a moment after the last key
  useEffect(() => {
    if (draft === query) return
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (draft.trim()) next.set('q', draft.trim())
      else next.delete('q')
      next.delete('strona')
      setParams(next, { replace: true })
    }, 300)
    return () => window.clearTimeout(t)
  }, [draft, query, params, setParams])

  useEffect(() => {
    let alive = true
    setError(null)
    adminUsers(query, page, blocked)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [query, page, blocked])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'strona') next.delete('strona')
    setParams(next, { replace: key !== 'strona' })
  }

  const search = params.toString() ? `?${params}` : ''

  return (
    <AdminShell
      title="Użytkownicy"
      subtitle={data ? `${plural(data.total, 'konto', 'konta', 'kont')}${query || blocked ? ' pasujących do filtrów' : ''}` : ' '}
    >
      {error && <p className="error">{error}</p>}
      <div className="admin-card flush">
        <div className="admin-toolbar">
          <div className="admin-toolbar-row">
            <div className="admin-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                aria-label="Szukaj użytkownika"
                placeholder="Szukaj: nazwa, e-mail lub telefon"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <div className="admin-chips" role="group" aria-label="Blokada">
              <button type="button" className="admin-chip" aria-pressed={!blocked} onClick={() => setParam('blokada', null)}>
                Wszyscy
              </button>
              <button type="button" className="admin-chip" aria-pressed={blocked} onClick={() => setParam('blokada', '1')}>
                Zablokowani
              </button>
            </div>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table data-testid="admin-users">
            <thead>
              <tr>
                <th>Użytkownik</th>
                <th>Kontakt</th>
                <th>Rejestracja</th>
                <th className="num">Aukcje</th>
                <th>Stan</th>
                <th className="num">Zaległe</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    Brak użytkowników pasujących do filtrów.
                  </td>
                </tr>
              )}
              {data?.items.map((u) => (
                <tr
                  key={u.id}
                  className="clickable"
                  data-user={u.id}
                  onClick={() => navigate(`/admin/users/${u.id}${search}`)}
                >
                  <td>
                    <Link to={`/admin/users/${u.id}${search}`} className="admin-cell-title" onClick={(e) => e.stopPropagation()}>
                      {userName(u)}
                    </Link>
                    <div className="admin-cell-sub">@{u.username}</div>
                  </td>
                  <td>
                    <div>{u.email || '—'}</div>
                    <div className="admin-cell-sub">{u.phone || 'brak telefonu'}</div>
                  </td>
                  <td>{formatDate(u.created_at)}</td>
                  <td className="num">
                    {u.auction_count}
                    {u.sold_count > 0 && <div className="admin-cell-sub">{u.sold_count} sprzed.</div>}
                  </td>
                  <td>
                    <UserBadges u={u} />
                  </td>
                  <td className="num">{u.overdue_amount > 0 ? formatPln(u.overdue_amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.total > PAGE_SIZE && (
          <div className="admin-table-foot">
            <Pagination
              page={page}
              pageCount={Math.ceil(data.total / PAGE_SIZE)}
              total={data.total}
              onChange={(p) => setParam('strona', p > 1 ? String(p) : null)}
            />
          </div>
        )}
      </div>
      {id && <UserDrawer key={id} id={id} onClose={() => navigate(`/admin/users${search}`)} />}
    </AdminShell>
  )
}
