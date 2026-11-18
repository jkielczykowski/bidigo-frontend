import { useEffect, useState } from 'react'
import { fetchPayuStatus, fetchQuote } from './ordersApi'
import { buyNowOffered } from './checkout'
import type { Quote } from './ordersLogic'

export type BuyNowOffer = { state: 'loading' | 'yes' | 'no'; quote: Quote | null }

/**
 * „Kup teraz” istnieje wyłącznie z Ochroną Kupującego: przycisk i cena „Kup teraz” pokazujemy tylko wtedy, gdy backend mówi,
 * że aukcja się kwalifikuje (order_quote) i PayU jest gotowe. W trakcie sprawdzania i przy błędzie: nie pokazujemy nic.
 * enabled = false (np. kategoria bez Paczkomatu, własna aukcja, brak ceny) od razu daje „no”.
 */
export function useBuyNowOffer(auctionId: string | undefined, price: number | null, enabled: boolean): BuyNowOffer {
  const [offer, setOffer] = useState<BuyNowOffer>({ state: 'loading', quote: null })
  useEffect(() => {
    if (!auctionId || price == null || !enabled) {
      setOffer({ state: 'no', quote: null })
      return
    }
    let off = false
    setOffer({ state: 'loading', quote: null })
    Promise.all([fetchQuote(auctionId, price).catch(() => null), fetchPayuStatus().catch(() => null)]).then(([quote, payu]) => {
      if (off) return
      setOffer({ state: buyNowOffered(true, quote, payu) ? 'yes' : 'no', quote })
    })
    return () => { off = true }
  }, [auctionId, price, enabled])
  return offer
}
