import { Link, Navigate, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import './AdminShell.css'

const NAV = [
  { to: '/admin', label: 'Podsumowanie', end: true, icon: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" /> },
  {
    to: '/admin/users',
    label: 'Użytkownicy',
    icon: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  },
  {
    to: '/admin/fees',
    label: 'Opłaty',
    icon: <path d="M2 7h20v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 7l2-4h16l2 4M16 14h2" />,
  },
  {
    to: '/admin/moderation',
    label: 'Moderacja',
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10M9 12l2 2 4-4" />,
  },
]

type Props = {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}

/** Admin pages: access check, side navigation shared by every admin view, page header. */
export function AdminShell({ title, subtitle, actions, children }: Props) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="container page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.is_admin) {
    return (
      <div className="container page">
        <h1>Panel admina</h1>
        <p className="error">Brak uprawnień administratora.</p>
        <Link to="/">Wróć na start</Link>
      </div>
    )
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-side-brand">Administracja</div>
        <nav aria-label="Panel admina">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="admin-nav-item">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {n.icon}
              </svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-content">
        <header className="admin-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="admin-muted">{subtitle}</p>}
          </div>
          {actions && <div className="admin-head-actions">{actions}</div>}
        </header>
        <div className="admin-main">{children}</div>
      </div>
    </div>
  )
}

export function StateBadge({ state, label }: { state: string; label: string }) {
  return <span className={`admin-badge is-${state}`}>{label}</span>
}
