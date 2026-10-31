import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCategories } from '../lib/categories'
import { useNotifications } from '../lib/notifications'
import { useUnreadMessages } from '../lib/unreadMessages'
import { BidigoLogo } from './BidigoLogo'
import { CategoryMenu } from './CategoryMenu'
import { SearchBar } from './SearchBar'

const ICONS: Record<string, string> = {
  list: 'M5 6h14M5 12h14M5 18h14',
  gavel: 'M13 4l7 7M8 9l7 7M11 6L6 11l7 7 5-5M4 20l5-5',
  store: 'M4 9l1-5h14l1 5M4 9v10h16V9M4 9c0 1.7 1.3 2.5 2.7 2.5S9.3 10.7 9.3 9c0 1.7 1.3 2.5 2.7 2.5s2.7-.8 2.7-2.5c0 1.7 1.3 2.5 2.7 2.5S20 10.7 20 9',
  coins: 'M12 5c4 0 7 1.1 7 2.5S16 10 12 10 5 8.9 5 7.5 8 5 12 5zM5 7.5v4C5 12.9 8 14 12 14s7-1.1 7-2.5v-4M5 11.5v4C5 16.9 8 18 12 18s7-1.1 7-2.5v-4',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8',
  user: 'M12 5a3.6 3.6 0 1 0 0 7.2A3.6 3.6 0 0 0 12 5zM5 20c.8-3.8 3.6-5.6 7-5.6s6.2 1.8 7 5.6',
  bell: 'M12 4a5 5 0 0 0-5 5v4l-2 3h14l-2-3V9a5 5 0 0 0-5-5zM10 19a2 2 0 0 0 4 0',
  chat: 'M4 5h16v11H9l-5 4z',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="nav-account-icon">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { unread } = useUnreadMessages()
  const { unread: notifUnread } = useNotifications()
  const categories = useCategories()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | null>(null)

  const badgeTotal = notifUnread + unread
  const profileBadge = badgeTotal > 0 ? (badgeTotal > 99 ? '99+' : String(badgeTotal)) : null

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen)
    return () => document.body.classList.remove('nav-open')
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  useEffect(() => {
    if (!profileOpen) return
    function onDocClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    }
  }, [])

  function closeMenu() {
    setMenuOpen(false)
    setProfileOpen(false)
  }

  function openProfileSoon() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setProfileOpen(true), 60)
  }

  function closeProfileSoon() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setProfileOpen(false), 160)
  }

  return (
    <div className="app-shell">
      <header className="header header--bidigo">
        <nav className="nav container">
          <BidigoLogo onClick={closeMenu} />
          <div className="nav-search desktop-only">
            <SearchBar compact variant="nav" placeholder="Czego szukasz?" />
          </div>

          <Link to="/favorites" className="nav-fav-mobile" onClick={closeMenu}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.7c0 5.4-7.5 10-7.5 10z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span>Ulubione</span>
          </Link>

          <button
            type="button"
            className={`nav-burger ${menuOpen ? 'is-open' : ''}`}
            aria-label={menuOpen ? 'Zamknij menu konta' : 'Menu konta'}
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((v) => !v)
              setProfileOpen(false)
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 20c.8-3.8 3.6-5.6 7-5.6s6.2 1.8 7 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="nav-burger-caret">
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <div className={`nav-backdrop ${menuOpen ? 'is-open' : ''}`} onClick={closeMenu} aria-hidden />

          <div className={`nav-drawer ${menuOpen ? 'is-open' : ''}`}>
            <div className="nav-drawer-head">
              <strong>Menu</strong>
              <button type="button" className="nav-drawer-close" aria-label="Zamknij menu" onClick={closeMenu}>
                ×
              </button>
            </div>

            <ul className="nav-account">
              {[
                { to: '/auctions', icon: 'list', label: 'Aukcje', badge: null },
                ...(user ? [{ to: '/my', icon: 'user', label: 'Panel Moje', badge: null }] : []),
                { to: '/my/bidding', icon: 'gavel', label: 'Licytuję', badge: null },
                { to: '/my/selling', icon: 'store', label: 'Moje aukcje', badge: null },
                ...(user
                  ? [
                      { to: '/my/activity', icon: 'pulse', label: 'Aktywność', badge: null },
                      { to: '/notifications', icon: 'bell', label: 'Powiadomienia', badge: notifUnread },
                      { to: '/messages', icon: 'chat', label: 'Wiadomości', badge: unread },
                    ]
                  : []),
                { to: '/my/fees', icon: 'coins', label: 'Opłaty', badge: null },
                { to: '/settings', icon: 'gear', label: 'Ustawienia konta', badge: null },
              ].map((l, i) => (
                <li key={l.to} style={{ ['--i' as string]: i }}>
                  <Link to={l.to} onClick={closeMenu}>
                    <NavIcon name={l.icon} />
                    <span>{l.label}</span>
                    {l.badge ? <span className="nav-unread">{l.badge > 99 ? '99+' : l.badge}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="nav-links">
              <NavLink to="/auctions" onClick={closeMenu}>
                Aukcje
              </NavLink>
              <NavLink to="/favorites" className="nav-fav" onClick={closeMenu}>
                <span aria-hidden>♡</span> Ulubione
              </NavLink>
              <Link to="/sell" className="btn btn-outline btn-sell" onClick={closeMenu}>
                + Wystaw
              </Link>
            </div>

            <div className="nav-actions">
              {user ? (
                <div
                  className={`nav-profile ${profileOpen ? 'is-open' : ''}`}
                  ref={profileRef}
                  onMouseEnter={openProfileSoon}
                  onMouseLeave={closeProfileSoon}
                >
                  <button
                    type="button"
                    className="nav-profile-btn"
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                    onClick={() => setProfileOpen((v) => !v)}
                  >
                    <span className="nav-profile-avatar" aria-hidden>
                      {(profile?.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="nav-profile-label">{profile?.display_name || 'Profil'}</span>
                    {profileBadge && <span className="nav-unread">{profileBadge}</span>}
                    <span className="nav-profile-caret" aria-hidden>
                      ▾
                    </span>
                  </button>

                  <div className="nav-profile-menu" role="menu">
                    <p className="nav-profile-name">{profile?.display_name ?? user.email}</p>
                    <Link to="/my" role="menuitem" onClick={closeMenu}>
                      Panel Moje
                    </Link>
                    <Link to="/my/selling" role="menuitem" onClick={closeMenu}>
                      Moje aukcje
                    </Link>
                    <Link to="/my/activity" role="menuitem" onClick={closeMenu}>
                      Aktywność
                    </Link>
                    <Link to="/my/bidding" role="menuitem" onClick={closeMenu}>
                      Licytuję
                    </Link>
                    <Link to="/notifications" role="menuitem" className="nav-messages" onClick={closeMenu}>
                      Powiadomienia
                      {notifUnread > 0 && (
                        <span className="nav-unread">{notifUnread > 99 ? '99+' : notifUnread}</span>
                      )}
                    </Link>
                    <Link to="/messages" role="menuitem" className="nav-messages" onClick={closeMenu}>
                      Wiadomości
                      {unread > 0 && <span className="nav-unread">{unread > 99 ? '99+' : unread}</span>}
                    </Link>
                    <div className="nav-profile-sep" aria-hidden />
                    <Link to="/my/fees" role="menuitem" onClick={closeMenu}>
                      Opłaty
                    </Link>
                    <Link to="/settings" role="menuitem" onClick={closeMenu}>
                      Ustawienia
                    </Link>
                    <button
                      type="button"
                      className="nav-profile-logout"
                      role="menuitem"
                      onClick={() => {
                        closeMenu()
                        void signOut().then(() => navigate('/'))
                      }}
                    >
                      Wyloguj
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link to="/login" className="nav-text-link nav-login" onClick={closeMenu}>
                    Zaloguj
                  </Link>
                  <Link to="/register" className="btn btn-primary nav-register" onClick={closeMenu}>
                    Dołącz
                  </Link>
                </>
              )}
              {user && (
                <button
                  type="button"
                  className="nav-logout-mobile"
                  onClick={() => {
                    closeMenu()
                    void signOut().then(() => navigate('/'))
                  }}
                >
                  Wyloguj
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>
      <div className="nav-search-row">
        <div className="container">
          <SearchBar compact variant="nav" placeholder="Czego szukasz?" />
        </div>
      </div>
      <CategoryMenu categories={categories} />
      <main className="main">{children}</main>
      <footer className="footer footer--bidigo">
        <div className="container footer-grid">
          <div className="footer-brand">
            <BidigoLogo />
            <p>Dobry handel zaczyna się tutaj.</p>
          </div>
          <div className="footer-links">
            <h4>Bidigo</h4>
            <Link to="/auctions">Aukcje</Link>
            <a href="/#jak-dziala">Jak to działa</a>
          </div>
          <div className="footer-links">
            <h4>Twoje konto</h4>
            <Link to="/login">Zaloguj się</Link>
            <Link to="/register">Dołącz do Bidigo</Link>
            <Link to="/sell">Wystaw przedmiot</Link>
          </div>
          <div className="footer-links">
            <h4>Pomoc</h4>
            <Link to="/pomoc">Centrum pomocy</Link>
            <Link to="/terms">Bezpieczny handel</Link>
            <Link to="/privacy">Kontakt</Link>
            <Link to="/terms">Regulamin</Link>
            <Link to="/privacy">Polityka prywatności</Link>
            <Link to="/usun-konto">Usuń konto</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>© {new Date().getFullYear()} Bidigo</p>
          <p className="footer-joke">bidigo.pl — domena w przygotowaniu</p>
        </div>
        <div className="container footer-company">
          <address>
            Loop Soft sp. z o.o., ul. Herbu Oksza 10/102, 02-495 Warszawa · KRS 0001271402 · NIP 5223386565 ·{' '}
            <a href="mailto:pomoc@bidigo.pl">pomoc@bidigo.pl</a>
          </address>
        </div>
      </footer>
    </div>
  )
}
