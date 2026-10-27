import { useEffect, useState } from 'react'
import type { PromotionPackage } from './database.types'
import { supabase } from './supabase'

/** Highlighted right now ("Promowane" badge) */
export function isPromoted(auction: { promoted_until?: string | null }, now = Date.now()) {
  return !!auction.promoted_until && new Date(auction.promoted_until).getTime() > now
}

export function usePromotionPackages() {
  const [packages, setPackages] = useState<PromotionPackage[]>([])
  useEffect(() => {
    void supabase
      .from('promotion_packages')
      .select('id, kind, name, description, days, price, sort_order')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setPackages(((data as PromotionPackage[]) ?? []).map((p) => ({ ...p, price: Number(p.price) }))))
  }, [])
  return packages
}
