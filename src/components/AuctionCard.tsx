import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Auction } from '../lib/database.types'
import { bidLabel, formatEndsAt, formatPln, formatRemaining } from '../lib/format'
import { isPromoted } from '../lib/promotions'

export function AuctionCard({ auction }: { auction: Auction }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const img = auction.image_urls?.[0]
  const endsAt = new Date(auction.ends_at).getTime()
  const msLeft = endsAt - now
  const live = auction.status === 'active' && msLeft > 0
  const ended = auction.status !== 'active' || msLeft <= 0
  const soon = live && msLeft <= 24 * 60 * 60 * 1000
  const bids = auction.bid_count ?? 0
  const promoted = live && isPromoted(auction, now)

  return (
    <Link
      to={`/auction/${auction.id}`}
      className={`auction-card${soon ? ' is-ending' : ''}${ended ? ' is-ended' : ''}${promoted ? ' is-promoted' : ''}`}
    >
      <div className="auction-card-media">
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className="auction-card-placeholder">Brak zdjęcia</div>
        )}
        <div className="auction-card-media-fade" aria-hidden />
        {live ? (
          <span className="live-pill">
            <span className="live-dot" aria-hidden />
            Na żywo
          </span>
        ) : (
          <span className="ended-pill">Zakończona</span>
        )}
        {promoted && <span className="promoted-badge auction-card-promoted">Promowane</span>}
        <span className={`auction-card-timer${soon ? ' is-soon' : ''}`}>
          {formatRemaining(auction.ends_at, now)}
          {live && <span className="auction-card-ends"> · do {formatEndsAt(auction.ends_at, now)}</span>}
        </span>
      </div>
      <div className="auction-card-body">
        <h3>{auction.title}</h3>
        <p className="meta">
          {auction.city || 'Polska'}
          {auction.category?.name ? ` · ${auction.category.name}` : ''}
        </p>
        <div className="auction-card-footer">
          <div className="auction-card-price-block">
            <strong className="price">{formatPln(auction.current_price)}</strong>
            <span className="auction-card-bids">{bidLabel(bids)}</span>
          </div>
          {auction.buy_now_price != null && live && (
            <span className="auction-card-buynow">Kup teraz {formatPln(auction.buy_now_price)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
