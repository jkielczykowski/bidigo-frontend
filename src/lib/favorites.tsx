import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  // The pop animation plays only when the visitor toggles the heart, not when favourites load
  const [pop, setPop] = useState(false)
  const popTimer = useRef<number | undefined>(undefined)
  // Demo cards have no row in the database
  if (auctionId.startsWith('demo-')) return null
  return (
    <button
      type="button"
      className={`fav-btn${on ? ' is-on' : ''}${pop ? ' is-pop' : ''}${withLabel ? ' fav-btn--wide' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!signedIn) {
          navigate('/login')
          return
        }
        setPop(true)
        window.clearTimeout(popTimer.current)
        popTimer.current = window.setTimeout(() => setPop(false), 450)
        void toggle(auctionId)
      }}
    >
      <svg className="fav-heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      {withLabel && <span>{on ? 'W ulubionych' : 'Dodaj do ulubionych'}</span>}
    </button>
  )
}
