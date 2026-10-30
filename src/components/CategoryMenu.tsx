import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { categoryDiscSources } from '../lib/categoryPhotos'
import type { Category } from '../lib/database.types'

const INLINE_TOP = 7
const WIDE = '(min-width: 900px)'

function Disc({ cat }: { cat: Category }) {
  const src = categoryDiscSources(cat.id, cat.name)
  return (
    <picture>
      <source srcSet={src.webp} type="image/webp" />
      <img src={src.jpg} alt="" width={32} height={32} loading="lazy" />
    </picture>
  )
}

/** Categories tucked into a menu: a bar with the first few, and "Wszystkie kategorie" opening the whole tree. */
export function CategoryMenu({ categories }: { categories: Category[] }) {
  const tops = useMemo(() => categories.filter((c) => !c.parent_id), [categories])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches)
  const openerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const close = () => {
    setOpen(false)
    openerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    document.body.classList.add('catmenu-open')
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        openerRef.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const f = [...panelRef.current.querySelectorAll<HTMLElement>('button, a')].filter((x) => x.offsetParent !== null)
      if (f.length === 0) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('catmenu-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const shown = active ?? (wide ? tops[0]?.id ?? null : null)
  const subs = (id: string) => categories.filter((c) => c.parent_id === id)
  const flyTop = tops.find((t) => t.id === shown) ?? null

  return (
    <nav className="catbar" aria-label="Kategorie">
      <div className="container catbar-in">
        <button
          ref={openerRef}
          type="button"
          className="catbar-all"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden>☰</span> Wszystkie kategorie
        </button>
        {tops.slice(0, INLINE_TOP).map((c) => (
          <Link key={c.id} to={`/auctions?cat=${encodeURIComponent(c.id)}`}>
            {c.name}
          </Link>
        ))}
      </div>

      {open && (
        <>
          <div className="catmenu-back" onClick={close} aria-hidden />
          <div className="catmenu" role="dialog" aria-modal="true" aria-label="Wszystkie kategorie" ref={panelRef}>
            <div className="catmenu-main">
              <div className="catmenu-head">
                <span>Wszystkie kategorie</span>
                <button ref={closeRef} type="button" className="catmenu-x" aria-label="Zamknij menu" onClick={close}>
                  ×
                </button>
              </div>
              <ul className="catmenu-list">
                {tops.map((c) => {
                  const isOpen = shown === c.id
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setActive(!wide && isOpen ? null : c.id)}
                        onMouseEnter={() => wide && setActive(c.id)}
                        onFocus={() => wide && setActive(c.id)}
                      >
                        <Disc cat={c} />
                        <span className="catmenu-name">{c.name}</span>
                        <span className="catmenu-chev" aria-hidden>
                          ›
                        </span>
                      </button>
                      {!wide && isOpen && (
                        <ul className="catmenu-sub">
                          <li>
                            <Link className="is-all" to={`/auctions?cat=${encodeURIComponent(c.id)}`} onClick={close}>
                              Wszystko w: {c.name}
                            </Link>
                          </li>
                          {subs(c.id).map((s) => (
                            <li key={s.id}>
                              <Link to={`/auctions?cat=${encodeURIComponent(s.id)}`} onClick={close}>
                                {s.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
            {wide && flyTop && (
              <div className="catmenu-fly" aria-live="polite">
                <h2>{flyTop.name}</h2>
                <Link className="is-all" to={`/auctions?cat=${encodeURIComponent(flyTop.id)}`} onClick={close}>
                  Wszystko w tej kategorii →
                </Link>
                <ul>
                  {subs(flyTop.id).map((s) => (
                    <li key={s.id}>
                      <Link to={`/auctions?cat=${encodeURIComponent(s.id)}`} onClick={close}>
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  )
}
