import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAuctionContext } from '../../context/AuctionContext'

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    roles: ['admin', 'team_owner', 'public'],
    links: [
      { to: '/dashboard',   label: 'Dashboard',     roles: ['admin', 'team_owner'] },
      { to: '/public-live', label: 'Live',           roles: ['public', 'team_owner', 'admin'] },
      { to: '/results',     label: 'Results',        roles: ['public', 'team_owner', 'admin'] },
      { to: '/squads',      label: 'Squads',         roles: ['public', 'team_owner', 'admin'] },
    ]
  },
  {
    id: 'setup',
    label: 'Setup',
    roles: ['admin'],
    links: [
      { to: '/auctions',    label: 'Auctions',       roles: ['admin'] },
      { to: '/setup',       label: 'Configuration',  roles: ['admin'] },
      { to: '/teams',       label: 'Teams',          roles: ['admin'] },
      { to: '/players',     label: 'Players',        roles: ['admin'] },
      { to: '/categories',  label: 'Categories',     roles: ['admin'] },
      { to: '/users',       label: 'Users',          roles: ['admin'] },
    ]
  },
  {
    id: 'run',
    label: 'Run Auction',
    roles: ['admin'],
    links: [
      { to: '/queue',       label: 'Queue',          roles: ['admin'] },
      { to: '/auction',     label: 'Auction Centre', roles: ['admin'] },
      { to: '/unsold',      label: 'Unsold',         roles: ['admin'] },
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
  if (role === 'admin' || role === 'team_owner') return '/dashboard'
  return '/public-live'
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
      // Hard navigation prevents any stale in-memory auth/router state.
      window.location.assign('/login')
      setSigningOut(false)
    }
  }

  const sponsors = Array.isArray(auction?.sponsor_logos) ? auction.sponsor_logos : []
  const overviewPath = getOverviewPath(role)

  return (
    <div className="min-h-screen">
      <header className="bg-ink-900/80 backdrop-blur border-b border-teal-700/40 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="shrink-0">
              <img
                src="/club-logo.png"
                alt="Club logo"
                className="h-10 w-10 rounded-lg object-cover ring-1 ring-teal-700/50"
              />
            </a>
            {auction?.banner_logo_url && (
              <img
                src={auction.banner_logo_url}
                alt=""
                className="h-8 w-8 rounded object-cover opacity-80 shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-score text-2xl text-white leading-none truncate">{title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-teal-400 capitalize">{role}</span>
                {auction && (
                  <span className={`text-[0.6rem] px-2 py-0.5 rounded-full font-semibold ${
                    auction.status === 'live'
                      ? 'bg-gold/20 text-gold animate-pulsegold'
                      : 'bg-teal-700/40 text-teal-200'
                  }`}>
                    {auction.status?.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {role !== 'public' && auctions.length > 0 && (
              <select
                value={auctionId ?? ''}
                onChange={(e) => selectAuction(e.target.value)}
                className="rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1.5 text-xs text-white max-w-[14rem]"
              >
                {auctions.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                ))}
              </select>
            )}
            {session ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-teal-400 hidden md:inline truncate max-w-[10rem]">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white hover:border-teal-500 transition"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
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
                    <div className="mx-2 h-4 w-px bg-teal-700/40 shrink-0" />
                  )}
                  {group.id === 'overview' ? (
                    <Link
                      to={overviewPath}
                      className={`
                        text-[0.6rem] uppercase tracking-widest px-1 shrink-0 hidden lg:block transition-colors
                        ${loc.pathname === overviewPath ? 'text-gold' : 'text-teal-600 hover:text-teal-300'}
                      `}
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <span className="text-[0.6rem] uppercase tracking-widest text-teal-600 px-1 shrink-0 hidden lg:block">
                      {group.label}
                    </span>
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

        {sponsors.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-4">
            <span className="text-[0.6rem] uppercase tracking-widest text-teal-500">Sponsors</span>
            {sponsors.map((s, i) => (
              s?.url ? <img key={i} src={s.url} alt={s.name || ''} title={s.name || ''} className="h-7 object-contain" /> : null
            ))}
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto p-4">{children}</main>
    </div>
  )
}
