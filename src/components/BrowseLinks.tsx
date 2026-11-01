import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category } from '../lib/database.types'

const PREVIEW = 24

function LinkList({ items, expanded }: { items: Category[]; expanded: boolean }) {
  const shown = expanded ? items : items.slice(0, PREVIEW)
  return (
    <p className="browse-list">
      {shown.map((c, i) => (
        <span key={c.id}>
          <Link to={`/auctions?cat=${encodeURIComponent(c.id)}`}>{c.name}</Link>
          {i < shown.length - 1 ? ', ' : ''}
        </span>
      ))}
    </p>
  )
}

/** Quiet link lists under the auctions (like the ones on ricardo.ch): subcategories, then the main categories. */
export function BrowseLinks({ categories }: { categories: Category[] }) {
  const [all, setAll] = useState(false)
  const tops = useMemo(() => categories.filter((c) => !c.parent_id), [categories])
  const subs = useMemo(() => categories.filter((c) => c.parent_id), [categories])
  if (categories.length === 0) return null

  return (
    <section className="browse" aria-label="Przeglądaj kategorie">
      <div className="container">
        {subs.length > 0 && (
          <>
            <h2>Może Cię zainteresować</h2>
            <LinkList items={subs} expanded={all} />
            {subs.length > PREVIEW && (
              <button type="button" className="browse-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
                {all ? 'Pokaż mniej' : 'Pokaż wszystkie'}
              </button>
            )}
          </>
        )}
        <h2>Kategorie</h2>
        <LinkList items={tops} expanded />
        <button type="button" className="browse-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span aria-hidden>↑</span> Na górę
        </button>
      </div>
    </section>
  )
}
