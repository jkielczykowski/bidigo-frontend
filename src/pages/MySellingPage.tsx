import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuctionCard } from '../components/AuctionCard'
import { Pagination } from '../components/Pagination'
import { useAuth } from '../lib/auth'
import type { Auction } from '../lib/database.types'
import { formatPln } from '../lib/format'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 12

type BidActivity = {
  auction_id: string
  amount: number
  created_at: string
  bidder?: { display_name: string | null } | null
}

export function MySellingPage() {
  const { user } = useAuth()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const [selling, setSelling] = useState<Auction[]>([])
  const [sellingTotal, setSellingTotal] = useState(0)
  const [sellingPage, setSellingPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [lastBidByAuction, setLastBidByAuction] = useState<Map<string, BidActivity>>(new Map())

  const sellingPageCount = Math.max(1, Math.ceil(sellingTotal / PAGE_SIZE))

  useEffect(() => {
    if (!user) return
    async function loadSelling() {
      setLoading(true)
      const from = (sellingPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, count } = await supabase
        .from('auctions')
        .select('*, category:categories(*)', { count: 'exact' })
        .eq('seller_id', user!.id)
        .order('created_at', { ascending: false })
        .range(from, to)
      setSelling((data as Auction[]) ?? [])
      setSellingTotal(count ?? 0)
      setLoading(false)
    }
    void loadSelling()
  }, [user, sellingPage])

  useEffect(() => {
    async function loadLastBids() {
      const sellIds = selling.map((a) => a.id)
      if (!sellIds.length) {
        setLastBidByAuction(new Map())
        return
      }
      const { data: recentBids } = await supabase
        .from('bids')
        .select('auction_id, amount, created_at, bidder:profiles!bids_bidder_id_fkey(display_name)')
        .in('auction_id', sellIds)
        .order('created_at', { ascending: false })
        .limit(sellIds.length * 3)
      const map = new Map<string, BidActivity>()
      for (const raw of (recentBids as unknown as BidActivity[]) ?? []) {
        const b = {
          ...raw,
          bidder: Array.isArray(raw.bidder) ? raw.bidder[0] ?? null : raw.bidder,
        }
        if (!map.has(b.auction_id)) map.set(b.auction_id, b)
      }
      setLastBidByAuction(map)
    }
    void loadLastBids()
  }, [selling])

  function goSellingPage(p: number) {
    setSellingPage(Math.min(Math.max(1, p), sellingPageCount))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!user) {
    return (
      <div className="container page">
        <p>
          <Link to="/login">Zaloguj się</Link>, żeby zobaczyć swoje aukcje.
        </p>
      </div>
    )
  }

  return (
    <div className="container page">
      <Link to="/my" className="my-back-link">
        ← Panel Moje
      </Link>
      <div className="page-head-row">
        <h1>Moje aukcje</h1>
        <div className="page-head-actions">
          <Link to="/sell" className="btn btn-primary">
            Wystaw
          </Link>
        </div>
      </div>

      {notice && <p className="mod-banner pending">{notice}</p>}

      {sellingTotal > 0 && (
        <p className="muted my-section-count">
          {sellingTotal} {sellingTotal === 1 ? 'aukcja' : sellingTotal < 5 ? 'aukcje' : 'aukcji'}
          {sellingPageCount > 1 ? ` · strona ${sellingPage}/${sellingPageCount}` : ''}
        </p>
      )}

      {loading ? (
        <p className="muted">Ładowanie…</p>
      ) : selling.length === 0 ? (
        <p className="muted">
          Nic jeszcze nie wystawiłeś. <Link to="/sell">Wystaw pierwszą aukcję</Link>
        </p>
      ) : (
        <>
          <div className="selling-list">
            {selling.map((a) => {
              const last = lastBidByAuction.get(a.id)
              return (
                <div key={a.id} className="selling-item">
                  <AuctionCard auction={a} />
                  {a.status === 'active' && a.moderation_status === 'pending_review' && (
                    <p className="selling-bid-info mod-pill">Oznaczono do sprawdzenia</p>
                  )}
                  {a.status === 'cancelled' && a.moderation_status === 'rejected' && (
                    <p className="selling-bid-info mod-pill rejected">Odrzucona przez administratora</p>
                  )}
                  {a.status === 'active' && last && a.moderation_status !== 'pending_review' && (
                    <p className="selling-bid-info">
                      Ostatnia oferta: <strong>{formatPln(last.amount)}</strong>
                      {last.bidder?.display_name ? ` od ${last.bidder.display_name}` : ''}
                    </p>
                  )}
                  {a.status === 'active' && Number(a.bid_count) === 0 && (
                    <p className="selling-bid-info muted">Na razie bez ofert</p>
                  )}
                  {a.status === 'active' && (
                    <>
                      <Link to={`/auction/${a.id}/edit`} className="btn btn-outline btn-sm selling-edit">
                        Zarządzaj
                      </Link>
                      <Link to={`/auction/${a.id}`} className="btn btn-ghost btn-sm selling-edit">
                        Zakończ
                      </Link>
                      {a.moderation_status === 'approved' && (
                        <Link to={`/auction/${a.id}?promuj=1`} className="btn btn-primary btn-sm selling-edit">
                          Promuj
                        </Link>
                      )}
                    </>
                  )}
                  {a.status === 'sold' && (
                    <Link to={`/auction/${a.id}`} className="btn btn-outline btn-sm selling-edit">
                      Chat z kupującym
                    </Link>
                  )}
                  {a.status === 'ended' && (
                    <Link to={`/sell?relist=${a.id}`} className="btn btn-outline btn-sm selling-edit">
                      Wystaw ponownie
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
          <Pagination
            page={sellingPage}
            pageCount={sellingPageCount}
            onChange={goSellingPage}
            label="Strony wystawionych aukcji"
          />
        </>
      )}
    </div>
  )
}
