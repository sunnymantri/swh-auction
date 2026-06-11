import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAuctionContext } from '../../context/AuctionContext'
import packageMeta from '../../../package.json'

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    roles: ['admin', 'team_owner', 'public'],
    links: [
      { to: '/public-live', label: 'Live',     roles: ['public', 'team_owner', 'admin'] },
      { to: '/results',     label: 'Results',  roles: ['public', 'team_owner', 'admin'] },
      { to: '/vacation',    label: 'Vacation', roles: ['public', 'team_owner', 'admin'] },
    ]
  },
  {
    id: 'setup',
    label: 'Setup',
    roles: ['admin'],
    links: [
      { to: '/auctions', label: 'Auctions', roles: ['admin'] },
      { to: '/teams',    label: 'Teams',    roles: ['admin'] },
      { to: '/players',  label: 'Players',  roles: ['admin'] },
      { to: '/users',    label: 'Users',    roles: ['admin'] },
    ]
  },
  {
    id: 'run',
    label: 'Run Auction',
    roles: ['admin'],
    links: [
      { to: '/queue',   label: 'Queue',          roles: ['admin'] },
      { to: '/auction', label: 'Auction Centre', roles: ['admin'] },
    ]
  },
  {
    id: 'bid',
    label: 'Bidding',
    roles: ['team_owner', 'admin'],
    links: [
      { to: '/team-bidding', label: 'Team Bidding', roles: ['team_owner', 'admin'] },
    ]
  }
]

function getOverviewPath(role) {
  if (role === 'admin' || role === 'team_owner') return '/public-live'
  return '/public-live'
}

function UserMenu({ email, role, onSignOut, signingOut }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const initial = (email || '?').trim().charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full border border-teal-700/40 hover:border-teal-500 bg-ink-800/60 hover:bg-ink-800 pl-1 pr-2 py-1 transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="h-7 w-7 rounded-full bg-teal-700/40 text-teal-100 grid place-items-center text-xs font-semibold">
          {initial}
        </span>
        <svg className="w-3 h-3 text-teal-400" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl border border-teal-700/40 bg-ink-900 shadow-card overflow-hidden z-30"
        >
          <div className="px-3 py-2.5 border-b border-teal-700/30">
            <p className="text-xs text-white truncate">{email}</p>
            <p className="text-[0.65rem] uppercase tracking-wider text-teal-500 mt-0.5">{role}</p>
          </div>
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="w-full text-left px-3 py-2 text-xs text-teal-200 hover:bg-ink-800 hover:text-white transition disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppShell({ title, children }) {
  const { role, signOut, user, session } = useAuth()
  const { auction, auctions, auctionId, selectAuction } = useAuctionContext()
  const loc = useLocation()
  const nav = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      localStorage.removeItem('ca.selectedAuctionId')
      nav('/login', { replace: true })
      window.location.assign('/login')
      setSigningOut(false)
    }
  }

  const sponsors = Array.isArray(auction?.sponsor_logos) ? auction.sponsor_logos : []
  const overviewPath = getOverviewPath(role)
  const footerVersion = `v${String(packageMeta.version || '0.0.0').split('.').slice(0, 2).join('.')}`

  const headingPrimary = auction?.name || title
  const headingCaption = auction?.name ? title : null

  return (
    <div className="min-h-screen">
      <header className="bg-ink-900/80 backdrop-blur border-b border-teal-700/40 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="shrink-0 flex items-center gap-2">
              <img
                src="/club-logo.png"
                alt="Club logo"
                className="h-10 w-10 rounded-lg object-cover ring-1 ring-teal-700/50"
              />
              {auction?.banner_logo_url && (
                <>
                  <span className="h-7 w-px bg-teal-700/40" aria-hidden="true" />
                  <img
                    src={auction.banner_logo_url}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover ring-1 ring-teal-700/30"
                  />
                </>
              )}
            </a>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-score text-xl sm:text-2xl text-white leading-none truncate">{headingPrimary}</h1>
                {auction && (
                  <span className={`text-[0.65rem] sm:text-[0.7rem] px-2 py-0.5 rounded-full font-semibold tracking-wider ${
                    auction.status === 'live'
                      ? 'bg-gold/20 text-gold animate-pulsegold'
                      : 'bg-teal-700/40 text-teal-200'
                  }`}>
                    {auction.status?.toUpperCase()}
                  </span>
                )}
              </div>
              {headingCaption && (
                <p className="text-xs text-teal-400 mt-1 truncate">{headingCaption}</p>
              )}
            </div>
          </div>

          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3">
            {role !== 'public' && auctions.length > 0 && (
              <div className="relative w-full sm:w-auto max-w-[16rem]">
                <select
                  value={auctionId ?? ''}
                  onChange={(e) => selectAuction(e.target.value)}
                  className="appearance-none w-full rounded-lg bg-ink-800/60 hover:bg-ink-800 border border-teal-700/40 hover:border-teal-500 pl-3 pr-8 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 transition cursor-pointer"
                >
                  {auctions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-teal-400" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            {session ? (
              <UserMenu
                email={user?.email}
                role={role}
                onSignOut={handleSignOut}
                signingOut={signingOut}
              />
            ) : (
              <Link to="/login" className="text-xs px-2.5 py-1.5 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white transition">
                Sign in
              </Link>
            )}
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-4 pb-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {NAV_GROUPS
            .filter(g => g.roles.includes(role))
            .map((group, gi) => {
              const visibleLinks = group.links.filter(l => l.roles.includes(role))
              if (visibleLinks.length === 0) return null
              return (
                <div key={group.id} className="flex items-center gap-0.5">
                  {gi > 0 && (
                    <div className="hidden sm:block mx-2 h-4 w-px bg-teal-700/40 shrink-0" />
                  )}
                  {visibleLinks.map(l => {
                    const active = loc.pathname === l.to
                    return (
                      <Link
                        key={l.to}
                        to={l.to}
                        className={`
                          relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors
                          ${active ? 'text-gold' : 'text-teal-300 hover:text-white'}
                        `}
                      >
                        {l.label}
                        {active && (
                          <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gold" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })
          }
        </nav>
      </header>

      {sponsors.length > 0 && (
        <div className="border-b border-teal-700/20 bg-ink-900/40">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-[0.65rem] sm:text-xs uppercase tracking-widest text-teal-500">Sponsors</span>
            {sponsors.map((s, i) => (
              s?.url ? <img key={i} src={s.url} alt={s.name || ''} title={s.name || ''} className="h-6 sm:h-7 object-contain" /> : null
            ))}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-3 sm:p-4">{children}</main>
      <footer className="border-t border-teal-700/30 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1">
          <p className="text-xs text-teal-500">
            {footerVersion} · Developed by Sunny Mantri for South West Hitters Cricket Club
          </p>
          <p className="text-[0.7rem] sm:text-xs text-teal-600">
            ABN 56 495 977 829
          </p>
        </div>
      </footer>
    </div>
  )
}
