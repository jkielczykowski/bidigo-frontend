import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import { supabase } from '../lib/supabase'

export type AppNotification = {
  id: string
  user_id: string
  type:
    | 'bid_received'
    | 'outbid'
    | 'sold'
    | 'auction_ended'
    | 'auction_won'
    | 'moderation_held'
    | 'moderation_rejected'
    | 'moderation_approved'
    | 'seller_rated'
    | 'auction_comment'
    | 'fee_due'
    | 'fee_overdue'
    | 'fee_settlement'
    | 'antifraud_explain'
    | 'antifraud_warning'
    | 'antifraud_warning_risk'
    | 'antifraud_block'
    | 'antifraud_decision'
  title: string
  body: string
  auction_id: string | null
  read_at: string | null
  created_at: string
}

const PAGE_SIZE = 12

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'przed chwilą'
  if (m < 60) return `${m} min temu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} godz. temu`
  const d = Math.floor(h / 24)
  return `${d} dn. temu`
}

function typeLabel(type: AppNotification['type']) {
  switch (type) {
    case 'bid_received':
      return 'Oferta'
    case 'outbid':
      return 'Przebicie'
    case 'sold':
      return 'Sprzedaż'
    case 'auction_ended':
      return 'Koniec'
    case 'auction_won':
      return 'Wygrana'
    case 'seller_rated':
      return 'Ocena'
    case 'auction_comment':
      return 'Pytanie'
    case 'moderation_held':
      return 'Weryfikacja'
    case 'moderation_rejected':
      return 'Odrzucone'
    case 'moderation_approved':
      return 'OK'
    case 'fee_due':
      return 'Prowizja'
    case 'fee_overdue':
      return 'Blokada'
    case 'fee_settlement':
      return 'Rozliczenie'
    case 'antifraud_explain':
      return 'Wyjaśnij'
    case 'antifraud_warning':
    case 'antifraud_warning_risk':
      return 'Ostrzeżenie'
    case 'antifraud_block':
      return 'Blokada'
    case 'antifraud_decision':
      return 'Decyzja'
    default:
      return 'Info'
  }
}

type Tab = 'unread' | 'all'

export function NotificationsPage() {
  const { user } = useAuth()
  const { unread, refresh } = useNotifications()
  const [tab, setTab] = useState<Tab>('unread')
  const [items, setItems] = useState<AppNotification[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let q = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (tab === 'unread') {
      q = q.is('read_at', null)
    }

    const { data, count } = await q
    setItems((data as AppNotification[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [user, page, tab])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  async function markAllRead() {
    setBusy(true)
    const { error } = await supabase.rpc('mark_notifications_read')
    if (error) console.error(error)
    await refresh()
    if (tab === 'unread') {
      setItems([])
      setTotal(0)
      setPage(1)
    } else {
      await load()
    }
    setBusy(false)
  }

  async function markOne(id: string) {
    const { error } = await supabase.rpc('mark_notifications_read', { p_ids: [id] })
    if (error) console.error(error)
    await refresh()
    if (tab === 'unread') {
      setItems((prev) => {
        const next = prev.filter((n) => n.id !== id)
        if (next.length === 0 && page > 1) {
          setPage((p) => p - 1)
        }
        return next
      })
      setTotal((t) => Math.max(0, t - 1))
    } else {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)),
      )
    }
  }

  function goPage(p: number) {
    setPage(Math.min(Math.max(1, p), pageCount))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!user) {
    return (
      <div className="container page">
        <p>
          <Link to="/login">Zaloguj się</Link>, żeby zobaczyć powiadomienia.
        </p>
      </div>
    )
  }

  return (
    <div className="container page narrow">
      <div className="page-head-row">
        <h1>Powiadomienia</h1>
        {unread > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy}
            onClick={() => void markAllRead()}
          >
            Oznacz wszystkie jako przeczytane
          </button>
        )}
      </div>

      <p className="muted">
        Oferty, przebicia, sprzedaż i weryfikacja aukcji. Przeczytane znikają z listy „Nowe”.
      </p>

      <div className="notif-tabs" role="tablist" aria-label="Filtr powiadomień">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'unread'}
          className={tab === 'unread' ? 'notif-tab active' : 'notif-tab'}
          onClick={() => setTab('unread')}
        >
          Nowe{unread > 0 ? ` (${unread})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={tab === 'all' ? 'notif-tab active' : 'notif-tab'}
          onClick={() => setTab('all')}
        >
          Wszystkie
        </button>
      </div>

      {loading && <p className="muted">Ładowanie…</p>}

      {!loading && items.length === 0 && (
        <div className="empty">
          <h2>{tab === 'unread' ? 'Brak nowych' : 'Brak powiadomień'}</h2>
          <p>
            {tab === 'unread'
              ? 'Wszystko przeczytane — tu pojawią się nowe oferty i wydarzenia.'
              : 'Jak ktoś złoży ofertę na Twoją aukcję — zobaczysz to tutaj.'}
          </p>
          <Link to="/my" className="btn btn-outline">
            Panel Moje
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <p className="muted notif-count">
            {total} {total === 1 ? 'powiadomienie' : total < 5 ? 'powiadomienia' : 'powiadomień'}
            {pageCount > 1 ? ` · strona ${page}/${pageCount}` : ''}
          </p>
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className={n.read_at ? 'notif-item' : 'notif-item unread'}>
                <div className="notif-item-top">
                  <span className={`notif-badge ${n.type}`}>{typeLabel(n.type)}</span>
                  <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
                </div>
                <strong className="notif-title">{n.title}</strong>
                <p className="notif-body">{n.body}</p>
                <div className="notif-actions">
                  {(n.type === 'fee_due' || n.type === 'fee_overdue' || n.type === 'fee_settlement') && (
                    <Link
                      to="/my/fees?status=pending"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (!n.read_at) void markOne(n.id)
                      }}
                    >
                      Zapłać prowizję
                    </Link>
                  )}
                  {n.type.startsWith('antifraud_') && (
                    <Link
                      to="/my/security"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (!n.read_at) void markOne(n.id)
                      }}
                    >
                      Zobacz szczegóły
                    </Link>
                  )}
                  {n.auction_id && (
                    <Link
                      to={`/auction/${n.auction_id}`}
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        if (!n.read_at) void markOne(n.id)
                      }}
                    >
                      Zobacz aukcję
                    </Link>
                  )}
                  {!n.read_at && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void markOne(n.id)}
                    >
                      Oznacz jako przeczytane
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageCount={pageCount}
            onChange={goPage}
            label="Strony powiadomień"
          />
        </>
      )}
    </div>
  )
}
