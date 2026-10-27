import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuctionPromotion } from '../lib/database.types'
import { formatPln } from '../lib/format'
import { supabase } from '../lib/supabase'

function day(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The seller's promotion purchases (bidigo-backend V41): paid ones and Checkouts still open */
export function PromotionHistory({ userId }: { userId: string }) {
  const [rows, setRows] = useState<AuctionPromotion[] | null>(null)

  useEffect(() => {
    void supabase
      .from('auction_promotions')
      .select('id, number, auction_id, package_id, kind, package_name, days, amount, status, created_at, paid_at, starts_at, ends_at, checkout_expires_at, refund_needed, auction:auctions(title)')
      .eq('seller_id', userId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as unknown as AuctionPromotion[]) ?? []))
  }, [userId])

  const now = Date.now()
  // A pending purchase whose Checkout is gone is just an abandoned attempt
  const visible = (rows ?? []).filter(
    (p) => p.status === 'paid' || (p.checkout_expires_at && new Date(p.checkout_expires_at).getTime() > now),
  )
  if (visible.length === 0) return null
  const paidTotal = visible.filter((p) => p.status === 'paid' && !p.refund_needed).reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <section className="my-fee-section my-promotions" aria-labelledby="fees-promotions">
      <h2 id="fees-promotions" className="my-fee-section-title">
        Promowanie <span className="muted">· zapłacono {formatPln(paidTotal)}</span>
      </h2>
      <div className="my-card-grid">
        {visible.map((p) => {
          const running = p.status === 'paid' && p.ends_at && new Date(p.ends_at).getTime() > now
          return (
            <article key={p.id} className="my-card" data-promotion={p.number}>
              <div className="my-card-top">
                <p className="my-card-kicker">{p.package_name}</p>
                <span className={`fee-status ${p.status === 'paid' ? 'paid' : 'pending'}`}>
                  {p.status !== 'paid'
                    ? 'Czeka na płatność'
                    : p.refund_needed
                      ? 'Do zwrotu'
                      : p.kind === 'bump'
                        ? 'Podbite'
                        : running
                          ? 'Trwa'
                          : 'Zakończone'}
                </span>
              </div>
              <h3 className="my-card-title">
                <Link to={`/auction/${p.auction_id}`}>{p.auction?.title ?? 'Aukcja'}</Link>
              </h3>
              <p className="muted">
                {formatPln(p.amount)} · {p.number}
                {p.paid_at ? ` · zapłacono ${day(p.paid_at)}` : ''}
              </p>
              {p.status === 'paid' && !p.refund_needed && p.kind !== 'bump' && p.starts_at && p.ends_at && (
                <p className="muted">
                  {day(p.starts_at)} – {day(p.ends_at)}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
