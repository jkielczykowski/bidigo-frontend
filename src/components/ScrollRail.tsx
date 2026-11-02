import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** Horizontal row of cards with ‹ › buttons (mouse users cannot swipe); the buttons hide at either end. */
export function ScrollRail({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, children])

  const scroll = (dir: number) => {
    const el = ref.current
    if (!el) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior })
  }

  return (
    <div className="detail-rail-wrap">
      <div
        ref={ref}
        className="detail-rail"
        tabIndex={0}
        role="region"
        aria-label={label}
        onScroll={update}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            scroll(e.key === 'ArrowRight' ? 1 : -1)
          }
        }}
      >
        {children}
      </div>
      {canPrev && (
        <button type="button" className="detail-rail-btn is-prev" aria-label="Poprzednie" onClick={() => scroll(-1)}>
          ‹
        </button>
      )}
      {canNext && (
        <button type="button" className="detail-rail-btn is-next" aria-label="Następne" onClick={() => scroll(1)}>
          ›
        </button>
      )}
    </div>
  )
}
