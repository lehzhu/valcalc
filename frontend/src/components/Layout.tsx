import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState(() =>
    localStorage.getItem('vc-audit-user') || 'Auditor'
  )

  useEffect(() => {
    localStorage.setItem('vc-audit-user', currentUser)
  }, [currentUser])

  return (
    <div className="min-h-screen bg-[var(--color-surface-secondary)]">
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
              ValCalc
            </Link>
            <nav className="flex gap-1">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-tertiary)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/valuations/new"
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              + New Valuation
            </Link>
            <div className="flex items-center gap-2 pl-3 border-l border-[var(--color-border)]">
              <div className="w-7 h-7 rounded-full bg-[var(--color-surface-tertiary)] flex items-center justify-center text-xs font-medium text-[var(--color-text-secondary)]">
                {currentUser.charAt(0).toUpperCase()}
              </div>
              <input
                type="text"
                value={currentUser}
                onChange={e => setCurrentUser(e.target.value)}
                className="text-sm text-[var(--color-text-secondary)] bg-transparent border-none outline-none w-24 focus:text-[var(--color-text-primary)]"
                placeholder="Your name"
              />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
