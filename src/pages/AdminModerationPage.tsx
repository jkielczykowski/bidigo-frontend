import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminShell } from '../components/AdminShell'
import { useAuth } from '../lib/auth'
import type { Auction } from '../lib/database.types'
import { formatPln } from '../lib/format'
import { supabase } from '../lib/supabase'

type ModerationAuction = Auction & {
  moderation_status: 'approved' | 'pending_review' | 'rejected'
  moderation_reasons: string[]
  moderation_notes: string | null
  seller?: { display_name: string | null; username: string | null } | null
}

export function AdminModerationPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ModerationAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const isAdmin = !!profile?.is_admin

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('auctions')
      .select('*, seller:profiles!auctions_seller_id_fkey(display_name, username)')
      .eq('moderation_status', 'pending_review')
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    setItems((data as ModerationAuction[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusyId(id)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('admin_moderate_auction', {
        p_auction_id: id,
        p_action: action,
        p_note: note[id]?.trim() || null,
      })
      if (err) throw err
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać decyzji')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminShell
      title="Moderacja aukcji"
      subtitle="Podejrzane aukcje trafiają tu do sprawdzenia. Ty decydujesz: zaakceptuj albo odrzuć."
      actions={
        <button type="button" className="btn btn-outline" onClick={() => void load()}>
          Odśwież
        </button>
      }
    >
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Ładowanie kolejki…</p>}

      {!loading && items.length === 0 && (
        <div className="empty">
          <h2>Kolejka pusta</h2>
          <p>Aktualnie żadna aukcja nie czeka na sprawdzenie.</p>
        </div>
      )}

      <div className="mod-queue">
        {items.map((a) => (
          <article key={a.id} className="mod-card">
            <div className="mod-card-gallery">
              {(a.image_urls?.length ? a.image_urls : [null]).map((url, i) =>
                url ? (
                  <a key={url + i} href={url} target="_blank" rel="noreferrer" className="mod-thumb">
                    <img src={url} alt={`Zdjęcie ${i + 1}`} />
                  </a>
                ) : (
                  <div key={`empty-${i}`} className="mod-thumb empty">
                    Brak zdjęcia
                  </div>
                ),
              )}
            </div>
            <div className="mod-card-body">
              <div className="mod-card-meta">
                <span className="notif-badge bid_received">Do weryfikacji</span>
                <span className="muted">
                  {a.seller?.display_name || a.seller?.username || 'Sprzedawca'} ·{' '}
                  {new Date(a.created_at).toLocaleString('pl-PL')}
                </span>
              </div>
              <h2>{a.title}</h2>
              <p className="mod-price">
                Start {formatPln(a.starting_price)}
                {a.buy_now_price != null ? ` · Kup teraz ${formatPln(a.buy_now_price)}` : ''}
                {a.city ? ` · ${a.city}` : ''}
              </p>
              <p className="mod-desc">{a.description}</p>
              <ul className="mod-reasons">
                {(a.moderation_reasons || []).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <label className="mod-note">
                Notatka dla sprzedawcy (opcjonalnie)
                <input
                  value={note[a.id] || ''}
                  onChange={(e) => setNote((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  placeholder="Np. usuń wulgaryzmy / zmień zdjęcia"
                />
              </label>
              <div className="mod-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === a.id}
                  onClick={() => void decide(a.id, 'approve')}
                >
                  Zaakceptuj
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busyId === a.id}
                  onClick={() => void decide(a.id, 'reject')}
                >
                  Odrzuć aukcję
                </button>
                <Link to={`/auction/${a.id}`} className="btn btn-ghost">
                  Podgląd
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  )
}
