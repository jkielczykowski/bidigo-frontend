import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuctionCard } from '../components/AuctionCard'
import { useAuth } from '../lib/auth'
import type { Auction } from '../lib/database.types'
import { useFavorites } from '../lib/favorites'
import { AUCTION_CARD_COLUMNS, supabase } from '../lib/supabase'

export function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { ids } = useFavorites()
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const idKey = [...ids].sort().join('|')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    if (!idKey) {
      setAuctions([])
      setLoading(false)
      return
    }
    let cancelled = false
    void supabase
      .from('auctions')
      .select(AUCTION_CARD_COLUMNS)
      .in('id', idKey.split('|'))
      .then(({ data }) => {
        if (cancelled) return
        const list = (data as unknown as Auction[]) ?? []
        // Active ones first, soonest ending on top; finished ones at the end
        list.sort((a, b) => {
          const aLive = a.status === 'active' ? 0 : 1
          const bLive = b.status === 'active' ? 0 : 1
          return aLive - bLive || a.ends_at.localeCompare(b.ends_at)
        })
        setAuctions(list)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, idKey])

  if (authLoading) return <div className="container page" aria-busy="true" />

  if (!user) {
    return (
      <div className="container page">
        <h1>Ulubione</h1>
        <p>
          <Link to="/login">Zaloguj się</Link>, żeby zapisywać aukcje serduszkiem i wracać do nich z telefonu i
          komputera.
        </p>
      </div>
    )
  }

  return (
    <div className="container page">
      <h1>Ulubione</h1>
      {loading ? (
        <p className="muted">Ładowanie…</p>
      ) : auctions.length === 0 ? (
        <div className="empty-state">
          <p>Nie masz jeszcze ulubionych aukcji. Kliknij ♡ przy aukcji, żeby ją tu zapisać.</p>
          <Link to="/auctions?all=1" className="btn btn-primary">
            Przeglądaj aukcje
          </Link>
        </div>
      ) : (
        <div className="auction-grid">
          {auctions.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </div>
      )}
    </div>
  )
}
