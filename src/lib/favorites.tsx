import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import { supabase } from './supabase'

// Favourites are the `watches` table (user_id, auction_id): the same list the mobile app shows as "Ulubione".
type FavoritesValue = {
  ids: Set<string>
  signedIn: boolean
  toggle: (auctionId: string) => Promise<void>
}

const FavoritesContext = createContext<FavoritesValue | null>(null)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [ids, setIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!userId) {
      setIds(new Set())
      return
    }
    let cancelled = false
    void supabase
      .from('watches')
      .select('auction_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!cancelled) setIds(new Set(((data as { auction_id: string }[]) ?? []).map((r) => r.auction_id)))
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const toggle = useCallback(
    async (auctionId: string) => {
      if (!userId) return
      const remove = ids.has(auctionId)
      // Optimistic: the heart flips at once, a failed write restores the server's list
      setIds((prev) => {
        const next = new Set(prev)
        if (remove) next.delete(auctionId)
        else next.add(auctionId)
        return next
      })
      const res = remove
        ? await supabase.from('watches').delete().eq('user_id', userId).eq('auction_id', auctionId)
        : await supabase.from('watches').insert({ user_id: userId, auction_id: auctionId })
      if (res.error) {
        const { data } = await supabase.from('watches').select('auction_id').eq('user_id', userId)
        setIds(new Set(((data as { auction_id: string }[]) ?? []).map((r) => r.auction_id)))
      }
    },
    [ids, userId],
  )

  const value = useMemo(() => ({ ids, signedIn: Boolean(userId), toggle }), [ids, userId, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites outside FavoritesProvider')
  return ctx
}

/** Heart on an auction card. Signed-out visitors are sent to the login page. */
export function FavoriteButton({
  auctionId,
  className = '',
  withLabel = false,
}: {
  auctionId: string
  className?: string
  withLabel?: boolean
}) {
  const { ids, signedIn, toggle } = useFavorites()
  const navigate = useNavigate()
  const on = ids.has(auctionId)
  // Demo cards have no row in the database
  if (auctionId.startsWith('demo-')) return null
  return (
    <button
      type="button"
      className={`fav-btn${on ? ' is-on' : ''}${withLabel ? ' fav-btn--wide' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!signedIn) {
          navigate('/login')
          return
        }
        void toggle(auctionId)
      }}
    >
      <span aria-hidden>{on ? '♥' : '♡'}</span>
      {withLabel && <span>{on ? 'W ulubionych' : 'Dodaj do ulubionych'}</span>}
    </button>
  )
}
