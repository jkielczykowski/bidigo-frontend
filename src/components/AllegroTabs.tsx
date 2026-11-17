import { NavLink } from 'react-router-dom'

const TABS: [string, string][] = [
  ['/sell/import/connection', 'Połączenie'],
  ['/sell/import', 'Import ofert'],
  ['/sell/import/imported', 'Zaimportowane'],
]

/** The three screens of the Allegro import: connect the account, pick offers, the table of what was imported. */
export function AllegroTabs() {
  return (
    <nav className="alg-tabs" aria-label="Import z Allegro">
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `alg-tab${isActive ? ' is-active' : ''}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
