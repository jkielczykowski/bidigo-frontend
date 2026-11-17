import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FeeBlockBanner } from '../components/FeeBlockBanner'
import { useAuth } from '../lib/auth'
import { useFeeBlock } from '../lib/feeBlock'
import { AntifraudBanner } from '../components/AntifraudBanner'
import { strikeLabel } from '../lib/antifraud'
import { useAntifraud } from '../lib/useAntifraud'
import { useNotifications } from '../lib/notifications'
import { useUnreadMessages } from '../lib/unreadMessages'
import { formatPln } from '../lib/format'
import { supabase } from '../lib/supabase'

type HubStats = {
  selling: number
  bidding: number
  pendingFees: number
  pendingFeeCount: number
  activity: number
}

type Tile = {
  to: string
  title: string
  desc: string
  meta: string
  accent?: boolean
  badge?: string
}

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="my-hub-grid">
      {tiles.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={`my-hub-tile${t.accent ? ' my-hub-tile-accent' : ''}`}
        >
          <div className="my-hub-tile-top">
            <h3>{t.title}</h3>
            {t.badge && <span className="my-hub-badge">{t.badge}</span>}
          </div>
          <p className="my-hub-tile-desc">{t.desc}</p>
          <p className="my-hub-tile-meta">{t.meta}</p>
        </Link>
      ))}
    </div>
  )
}

export function MyHubPage() {
  const { user, profile } = useAuth()
  const { unread: msgUnread } = useUnreadMessages()
  const { unread: notifUnread } = useNotifications()
  const { block } = useFeeBlock()
  const { status: afStatus } = useAntifraud()
  const [stats, setStats] = useState<HubStats>({
    selling: 0,
    bidding: 0,
    pendingFees: 0,
    pendingFeeCount: 0,
    activity: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const [{ count: sellCount }, { data: myBids }, { data: feeRows }, { data: sellIds }] =
        await Promise.all([
          supabase
            .from('auctions')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', user!.id),
          supabase.from('bids').select('auction_id').eq('bidder_id', user!.id),
          supabase
            .from('seller_fees')
            .select('fee_amount, status')
            .eq('seller_id', user!.id)
            .eq('status', 'pending'),
          supabase.from('auctions').select('id').eq('seller_id', user!.id),
        ])

      const bidIds = new Set((myBids ?? []).map((b: { auction_id: string }) => b.auction_id))
      const pending = (feeRows ?? []) as { fee_amount: number; status: string }[]
      const ids = (sellIds ?? []).map((r: { id: string }) => r.id)
      let activity = 0
      if (ids.length) {
        const { count } = await supabase
          .from('bids')
          .select('id', { count: 'exact', head: true })
          .in('auction_id', ids.slice(0, 300))
        activity = count ?? 0
      }

      setStats({
        selling: sellCount ?? 0,
        bidding: bidIds.size,
        pendingFees: pending.reduce((s, f) => s + Number(f.fee_amount), 0),
        pendingFeeCount: pending.length,
        activity,
      })
      setLoading(false)
    }
    void load()
  }, [user])

  if (!user) {
    return (
      <div className="container page">
        <p>
          <Link to="/login">Zaloguj się</Link>, żeby wejść do panelu.
        </p>
      </div>
    )
  }

  const sellTiles: Tile[] = [
    {
      to: '/my/selling',
      title: 'Moje aukcje',
      desc: 'Wystawione i zakończone ogłoszenia',
      meta: loading ? '…' : `${stats.selling} aukcji`,
    },
    {
      to: '/my/activity',
      title: 'Aktywność',
      desc: 'Kto podbija Twoje aukcje',
      meta: loading ? '…' : stats.activity > 0 ? `${stats.activity} ofert` : 'Brak ofert',
      accent: stats.activity > 0,
    },
    {
      to: '/my/fees',
      title: 'Opłaty',
      desc: 'Rozliczenia z wcześniejszych sprzedaży',
      meta: loading
        ? '…'
        : stats.pendingFeeCount > 0
          ? `Do zapłaty: ${formatPln(stats.pendingFees)}`
          : 'Brak zaległości',
      accent: stats.pendingFeeCount > 0,
      badge: stats.pendingFeeCount > 0 ? String(stats.pendingFeeCount) : undefined,
    },
    {
      to: '/sell',
      title: 'Wystaw aukcję',
      desc: 'Nowe ogłoszenie w kilka minut',
      meta: 'Start teraz',
      accent: true,
    },
    {
      to: '/sell/import',
      title: 'Import z Allegro',
      desc: 'Połącz konto i przenieś swoje oferty na Bidigo',
      meta: 'Połącz z Allegro',
    },
  ]

  const buyTiles: Tile[] = [
    {
      to: '/my/bidding',
      title: 'Licytuję',
      desc: 'Aukcje z Twoimi ofertami',
      meta: loading ? '…' : `${stats.bidding} aukcji`,
    },
    {
      to: '/messages',
      title: 'Wiadomości',
      desc: 'Czaty z kupującymi i sprzedawcami',
      meta: msgUnread > 0 ? `${msgUnread} nowych` : 'Brak nowych',
      accent: msgUnread > 0,
      badge: msgUnread > 0 ? String(msgUnread > 99 ? '99+' : msgUnread) : undefined,
    },
    {
      to: '/notifications',
      title: 'Powiadomienia',
      desc: 'Oferty i ważne wydarzenia',
      meta: notifUnread > 0 ? `${notifUnread} nieprzeczytanych` : 'Wszystko przeczytane',
      accent: notifUnread > 0,
      badge: notifUnread > 0 ? String(notifUnread > 99 ? '99+' : notifUnread) : undefined,
    },
  ]

  const accountTiles: Tile[] = [
    {
      to: '/my/security',
      title: 'Bezpieczeństwo konta',
      desc: 'Ostrzeżenia, oceny systemowe, wyjaśnienia i odwołania',
      meta: !afStatus || afStatus.level === 'none' ? 'Bez uwag' : afStatus.blocked ? 'Konto zablokowane' : `Ostrzeżenie ${strikeLabel(afStatus.strikes, afStatus.threshold)}`,
      accent: !!afStatus && afStatus.level !== 'none',
    },
    {
      to: '/settings',
      title: 'Ustawienia',
      desc: 'Profil, miasto i dane konta',
      meta: profile?.display_name || user.email || 'Profil',
    },
  ]

  return (
    <div className="container page">
      <div className="page-hero my-hub-hero">
        <h1>
          Panel <span>Moje</span>
        </h1>
        <p>Wybierz kafelek — aukcje, opłaty i wiadomości są osobno, nie na jednej ścianie.</p>
      </div>

      <AntifraudBanner status={afStatus} />
      <FeeBlockBanner block={block} showDueSoon />

      <section className="my-hub-section">
        <header className="my-hub-section-head">
          <h2>Sprzedaż</h2>
          <p className="muted">Twoje oferty i aktywność</p>
        </header>
        <TileGrid tiles={sellTiles} />
      </section>

      <section className="my-hub-section">
        <header className="my-hub-section-head">
          <h2>Kupno i kontakt</h2>
          <p className="muted">Licytacje, czaty i alerty</p>
        </header>
        <TileGrid tiles={buyTiles} />
      </section>

      <section className="my-hub-section">
        <header className="my-hub-section-head">
          <h2>Konto</h2>
        </header>
        <TileGrid tiles={accountTiles} />
      </section>
    </div>
  )
}
