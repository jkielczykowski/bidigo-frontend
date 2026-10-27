import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import { useUnreadMessages } from '../lib/unreadMessages'
import { BidigoLogo } from './BidigoLogo'
import { SearchBar } from './SearchBar'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { unread } = useUnreadMessages()
  const { unread: notifUnread } = useNotifications()
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

          <button
            type="button"
            className={`nav-burger ${menuOpen ? 'is-open' : ''}`}
            aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu'}
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((v) => !v)
              setProfileOpen(false)
            }}
          >
            <span />
            <span />
            <span />
          </button>

          <div className={`nav-drawer ${menuOpen ? 'is-open' : ''}`}>
            <div className="nav-search mobile-only">
              <SearchBar compact variant="nav" placeholder="Czego szukasz?" />
            </div>

            <div className="nav-links">
              <NavLink to="/auctions" onClick={closeMenu}>
                Aukcje
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
                    {profile?.is_admin && (
                      <Link to="/admin" role="menuitem" onClick={closeMenu}>
                        Administracja
                      </Link>
                    )}
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
                  <Link to="/login" className="nav-text-link" onClick={closeMenu}>
                    Zaloguj
                  </Link>
                  <Link to="/register" className="btn btn-primary" onClick={closeMenu}>
                    Dołącz
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>
      <main className="main">{children}</main>
      <footer className="footer footer--bidigo">
        <div className="container footer-grid">
          <div className="footer-brand">
            <BidigoLogo />
            <p>Dobry handel zaczyna się tutaj.</p>
          </div>
          <div className="footer-links">
            <h4>Bidigo</h4>
            <a href="/#o-nas">O nas</a>
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
          </div>
        </div>
        <div className="container footer-bottom">
          <p>© {new Date().getFullYear()} Bidigo</p>
          <p className="footer-joke">bidigo.pl — domena w przygotowaniu</p>
        </div>
      </footer>
    </div>
  )
}
