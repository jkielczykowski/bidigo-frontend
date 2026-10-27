import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, startPromotionCheckout } from '../lib/bidigoApi'
import type { Auction, AuctionPromotion } from '../lib/database.types'
import type { FeeBlock } from '../lib/feeBlock'
import { formatPln } from '../lib/format'
import { isPromoted, usePromotionPackages } from '../lib/promotions'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

/**
 * "Promuj" for the seller of a live auction: pick a package, pay with Stripe Checkout. The promotion
 * starts only after Stripe's webhook confirms the payment (bidigo-backend V41); Stripe sends the
 * seller back here with ?promotion=<purchase id> (or ?promotion_cancelled=<id>).
 */
export function PromoteAuction({ auction, feeBlock, onPaid }: { auction: Auction; feeBlock: FeeBlock | null; onPaid: () => void }) {
  const packages = usePromotionPackages()
  const [params, setParams] = useSearchParams()
  // "Promuj" on the seller's list links here with ?promuj=1
  const [open, setOpen] = useState(params.get('promuj') === '1')
  const [buying, setBuying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const returned = params.get('promotion')
  const cancelled = params.get('promotion_cancelled')
  const [returnedPromotion, setReturnedPromotion] = useState<AuctionPromotion | null>(null)
  const promoted = isPromoted(auction)
  const endsAt = new Date(auction.ends_at).getTime()

  // Back from Stripe: wait for the webhook to mark the purchase paid
  const checkReturned = useCallback(async () => {
    if (!returned) return null
    const { data } = await supabase
      .from('auction_promotions')
      .select('id, number, package_name, kind, status, ends_at')
      .eq('id', returned)
      .maybeSingle()
    const row = (data as AuctionPromotion | null) ?? null
    setReturnedPromotion(row)
    return row
  }, [returned])

  useEffect(() => {
    if (!returned) return
    let stopped = false
    let timer = 0
    const poll = async (left: number) => {
      const row = await checkReturned()
      if (stopped) return
      if (row?.status === 'paid') onPaid()
      else if (left > 0) timer = window.setTimeout(() => void poll(left - 1), 1500)
    }
    void poll(40)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll once per returned purchase
  }, [returned, checkReturned])

  async function buy(packageId: string) {
    setError(null)
    setBuying(packageId)
    try {
      const { checkoutUrl } = await startPromotionCheckout(auction.id, packageId)
      window.location.assign(checkoutUrl)
    } catch (e) {
      setBuying(null)
      const status = e instanceof ApiError ? e.status : 0
      if (status === 403) setError('Konto zablokowane za nieopłaconą prowizję — zapłać ją w zakładce Opłaty, żeby promować.')
      else if (status === 409) setError('Promować można tylko trwającą, zaakceptowaną aukcję.')
      else if (status === 503) setError('Płatności są chwilowo niedostępne. Spróbuj później.')
      else setError('Nie udało się rozpocząć płatności. Spróbuj ponownie.')
    }
  }

  function dismissReturn() {
    const next = new URLSearchParams(params)
    next.delete('promotion')
    next.delete('promotion_cancelled')
    next.delete('promuj')
    setParams(next, { replace: true })
  }

  return (
    <>
      {returned &&
        (returnedPromotion?.status === 'paid' ? (
          <p className="success promote-notice" role="status">
            Dziękujemy — {returnedPromotion.package_name} opłacone
            {returnedPromotion.kind === 'bump' ? ', aukcja jest na górze listy.' : ` (do ${formatDate(returnedPromotion.ends_at!)}).`}{' '}
            <button type="button" className="btn btn-ghost btn-sm" onClick={dismissReturn}>
              Zamknij
            </button>
          </p>
        ) : (
          <p className="muted promote-notice" role="status">
            Płatność przyjęta, czekamy na potwierdzenie ze Stripe — promowanie włączy się zaraz po nim…
          </p>
        ))}
      {cancelled && !returned && (
        <p className="muted promote-notice" role="status">
          Płatność przerwana — promowanie nie zostało kupione.
        </p>
      )}
      {promoted && (
        <p className="promote-state" data-testid="promotion-state">
          <span className="promoted-badge">Promowane</span> do {formatDate(auction.promoted_until!)}
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary promote-button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        Promuj
      </button>

      <Modal
        open={open}
        title="Promuj aukcję"
        onClose={() => {
          if (buying !== null) return
          setOpen(false)
          if (params.get('promuj')) dismissReturn()
        }}
      >
        <div className="promote-modal">
          <p className="muted">
            Promowana aukcja jest wyżej na liście, w kategorii i w wynikach wyszukiwania. Płacisz jednorazowo przez
            Stripe; promowanie włącza się po potwierdzeniu płatności i kończy się samo.
            {promoted ? ' Kolejne wyróżnienie przedłuży obecne.' : ''}
          </p>
          {feeBlock?.blocked && (
            <p className="error" role="alert">
              Konto zablokowane za nieopłaconą prowizję {formatPln(feeBlock.overdue_amount)} — zapłać ją w zakładce Opłaty,
              żeby promować.
            </p>
          )}
          <ul className="promote-packages">
            {packages.map((p) => {
              const outlasts = p.days > 0 && Date.now() + p.days * 86_400_000 > endsAt && !auction.auto_renew
              return (
                <li key={p.id} className="promote-package" data-package={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <p className="muted">{p.description}</p>
                    {outlasts && <p className="hint">Aukcja kończy się wcześniej, niż minie {p.days} dni.</p>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={buying !== null || !!feeBlock?.blocked}
                    onClick={() => void buy(p.id)}
                  >
                    {buying === p.id ? 'Przekierowanie…' : formatPln(p.price)}
                  </button>
                </li>
              )
            })}
          </ul>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
