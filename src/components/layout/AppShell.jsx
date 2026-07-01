import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { useAuctionContext } from '../../context/AuctionContext'
import { fmtStatus } from '../../lib/format'
import { updateUserProfile, uploadUserPhoto } from '../../lib/admin'
import packageMeta from '../../../package.json'

const ROLE_LABELS = { admin: 'Administrator', team_owner: 'Team Owner', public: 'Player' }

const NAV_ICONS = {
  Live: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M8 3.25V12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.75 12.75H12.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Results: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M3.5 12.5V7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 12.5V4.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.5 12.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Vacation: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M5 2.75V4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 2.75V4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="4" width="10" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 6.5H13" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  Players: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="8" cy="5.25" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.25 12.5C4.75 10.65 6.15 9.75 8 9.75C9.85 9.75 11.25 10.65 11.75 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  "Bidder's Console": (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M9.25 3.25L12.75 6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.75 4.75L11.25 8.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 6.5L9.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.75 9.25L8 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 12.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Auctions: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="3" y="3.5" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 6.5H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 9.5H8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Queue: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 4.5H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 8H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 11.5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Teams: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="5.25" cy="5.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10.75" cy="5.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 11.75C3.15 10.35 4.2 9.65 5.45 9.65C6.7 9.65 7.75 10.35 8.15 11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.85 11.75C8.25 10.35 9.3 9.65 10.55 9.65C11.8 9.65 12.85 10.35 13.25 11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Users: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="8" cy="5.25" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.25 12.5C4.75 10.65 6.15 9.75 8 9.75C9.85 9.75 11.25 10.65 11.75 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Squads: (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 4.5H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 11.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    roles: ['admin', 'team_owner', 'public'],
    links: [
      { to: '/public-live', label: 'Live',     roles: ['public'] },
      { to: '/results',     label: 'Results',  roles: ['public'] },
      { to: '/vacation',    label: 'Vacation', roles: ['public', 'team_owner', 'admin'], dropdown: [
        { label: 'Vacation', to: '/vacation' },
        { label: 'Schedule', to: '/schedule' },
      ]},
      { to: '/squads',      label: 'Squads',   roles: ['admin', 'team_owner'] },
    ]
  },
  {
    id: 'setup',
    label: 'Setup',
    roles: ['admin'],
    links: [
      { to: '/auctions',           label: 'Auctions',  roles: ['admin'], dropdown: [
        { label: 'Auctions', to: '/auctions' },
        { label: 'Queue', to: '/queue' },
      ]},
      { to: '/teams',              label: 'Teams',     roles: ['admin'] },
      { to: '/players', label: 'Players', roles: ['admin'], dropdown: [
        { label: 'Players list', tab: 'Players' },
        { label: 'Add Player',   tab: 'Add Player' },
        { label: 'Categories',   tab: 'Categories' },
        { label: 'Vacation',     tab: 'Vacation' },
      ]},
      { to: '/users',              label: 'Users',     roles: ['admin'] },
    ]
  },
  {
    id: 'bid',
    label: 'Bidding',
    roles: ['team_owner'],
    links: [
      { to: '/players', label: 'Players', roles: ['team_owner'], dropdown: [
        { label: 'Players list', tab: 'Players' },
        { label: 'Add Player',   tab: 'Add Player' },
        { label: 'Categories',   tab: 'Categories' },
        { label: 'Vacation',     tab: 'Vacation' },
      ]},
      { to: '/team-bidding', label: "Bidder's Console", roles: ['team_owner'] },
    ]
  }
]

function getOverviewPath(role) {
  if (role === 'admin') return '/auctions'
  if (role === 'team_owner') return '/public-live'
  return '/public-live'
}

function UserMenu({
  email,
  role,
  fullName,
  photoUrl,
  onSignOut,
  signingOut,
  onSaveProfile,
  savingProfile
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(fullName || '')
  const [photoDraft, setPhotoDraft] = useState(photoUrl || '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [editMsg, setEditMsg] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const initial = (fullName || email || '?').trim().charAt(0).toUpperCase()

  useEffect(() => {
    if (!editing) {
      setNameDraft(fullName || '')
      setPhotoDraft(photoUrl || '')
      setEditMsg('')
    }
  }, [editing, fullName, photoUrl])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full border border-gold/15 hover:border-gold/40 bg-black/15 hover:bg-black/25 pl-1 pr-2 py-1 transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="h-7 w-7 rounded-full bg-gold/15 text-gold-soft grid place-items-center text-xs font-semibold overflow-hidden ring-1 ring-gold/20">
          {photoUrl
            ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            : initial}
        </span>
        <svg className="w-3 h-3 text-gold/70" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl border border-gold/15 bg-[#0b1312] shadow-card overflow-hidden z-30"
        >
          <div className="px-3 py-2.5 border-b border-gold/10">
            <p className="text-sm font-medium text-white truncate">{fullName || email}</p>
            {fullName && <p className="text-xs text-[#a7beb8] truncate">{email}</p>}
            <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-gold/70">{ROLE_LABELS[role] ?? role}</p>
          </div>
          {editing && (
            <div className="px-3 py-2.5 border-b border-gold/10 space-y-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg bg-black/20 border border-gold/15 px-2 py-1.5 text-sm text-white"
              />
              <input
                value={photoDraft}
                onChange={(e) => setPhotoDraft(e.target.value)}
                placeholder="Photo URL"
                className="w-full rounded-lg bg-black/20 border border-gold/15 px-2 py-1.5 text-sm text-white"
              />
              <label className="inline-flex items-center rounded bg-gold/15 px-2 py-1 text-xs cursor-pointer text-gold-soft">
                {uploadingPhoto ? 'Uploading…' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setUploadingPhoto(true)
                    setEditMsg('')
                    try {
                      const url = await uploadUserPhoto(f)
                      setPhotoDraft(url)
                    } catch (err) {
                      setEditMsg(err.message || 'Photo upload failed')
                    } finally {
                      setUploadingPhoto(false)
                    }
                  }}
                />
              </label>
              {editMsg && <p className="text-[0.65rem] text-live">{editMsg}</p>}
            </div>
          )}
          <button
            onClick={async () => {
              if (!editing) {
                setEditing(true)
                return
              }
              setEditMsg('')
              try {
                await onSaveProfile?.({
                  full_name: nameDraft || null,
                  photo_url: photoDraft || null
                })
                setEditing(false)
              } catch (err) {
                setEditMsg(err.message || 'Failed to save profile')
              }
            }}
            disabled={savingProfile || uploadingPhoto}
            className="w-full text-left px-3 py-2 text-xs text-[#d8e2df] hover:bg-black/20 hover:text-white transition disabled:opacity-60"
          >
            {editing
              ? (savingProfile ? 'Saving profile…' : 'Save my profile')
              : 'Edit my profile'}
          </button>
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="w-full text-left px-3 py-2 text-xs text-[#d8e2df] hover:bg-black/20 hover:text-white transition disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppShell({ title, children }) {
  const { role, signOut, user, session, profile, refreshProfile } = useAuth()
  const { auction, auctions, auctionId, selectAuction } = useAuctionContext()
  const loc = useLocation()
  const nav = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [ddPos, setDdPos] = useState({ top: 0, left: 0 })
  const ddTimerRef = useRef(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const handleDdEnter = (to, el) => {
    clearTimeout(ddTimerRef.current)
    const rect = el.getBoundingClientRect()
    setDdPos({ top: rect.bottom + 2, left: rect.left })
    setOpenDropdown(to)
  }
  const handleDdLeave = () => {
    ddTimerRef.current = setTimeout(() => setOpenDropdown(null), 100)
  }
  const handleDdPanelEnter = () => clearTimeout(ddTimerRef.current)

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

  const handleSaveMyProfile = async (payload) => {
    if (!profile?.id) throw new Error('No profile found')
    setSavingProfile(true)
    try {
      await updateUserProfile(profile.id, payload)
      await refreshProfile()
    } finally {
      setSavingProfile(false)
    }
  }

  const sponsors = Array.isArray(auction?.sponsor_logos) ? auction.sponsor_logos : []
  const overviewPath = getOverviewPath(role)
  const footerVersion = `v${String(packageMeta.version || '0.0.0')}`

  const headingPrimary = auction?.name || title
  const headingCaption = auction?.name ? title : null
  const renderNavIcon = (label) => NAV_ICONS[label] ?? null

  return (
    <div className="min-h-screen">
      <header className="bg-[#091211]/90 backdrop-blur border-b border-gold/10 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="shrink-0 flex items-center gap-2">
              <img
                src="/club-logo.png"
                alt="Club logo"
                className="h-8 w-8 rounded-xl object-cover ring-1 ring-gold/25"
              />
              {auction?.banner_logo_url && (
                <>
                  <span className="h-7 w-px bg-gold/12" aria-hidden="true" />
                  <img
                    src={auction.banner_logo_url}
                    alt=""
                    className="h-9 w-9 rounded-xl object-cover ring-1 ring-gold/20"
                  />
                </>
              )}
            </a>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="va-page-title text-white leading-none truncate tracking-tight">{headingPrimary}</h1>
                {auction && (
                  <span className={`va-micro px-2.5 py-1 rounded-full font-semibold tracking-[0.16em] ${
                    auction.status === 'live'
                      ? 'bg-gold/20 text-gold animate-pulsegold'
                      : 'bg-gold/10 text-gold-soft'
                  }`}>
                    {fmtStatus(auction.status)}
                  </span>
                )}
              </div>
              {headingCaption && (
                <p className="va-support mt-1 truncate text-[#97aba6]">{headingCaption}</p>
              )}
            </div>
          </div>

          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3">
            {role !== 'public' && auctions.length > 0 && (
              <div className="relative w-full sm:w-auto max-w-[17rem]">
                <select
                  value={auctionId ?? ''}
                  onChange={(e) => selectAuction(e.target.value)}
                  className="appearance-none w-full rounded-xl bg-black/15 hover:bg-black/25 border border-gold/15 hover:border-gold/35 pl-3.5 pr-9 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/45 transition cursor-pointer"
                >
                  {auctions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({fmtStatus(a.status)})</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gold/70" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            {session ? (
              <UserMenu
                email={user?.email}
                role={role}
                fullName={profile?.full_name}
                photoUrl={profile?.photo_url}
                onSignOut={handleSignOut}
                signingOut={signingOut}
                onSaveProfile={handleSaveMyProfile}
                savingProfile={savingProfile}
              />
            ) : (
              <Link to="/login" className="va-micro px-2.5 py-1.5 rounded-lg border border-gold/15 text-gold-soft hover:text-white transition">
                Sign in
              </Link>
            )}
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {NAV_GROUPS
            .filter(g => g.roles.includes(role))
            .map((group, gi) => {
              const visibleLinks = group.links.filter(l => l.roles.includes(role))
              if (visibleLinks.length === 0) return null
              return (
                <div key={group.id} className="flex items-center gap-1">
                  {gi > 0 && (
                    <div className="hidden sm:block mx-2 h-6 w-px bg-gold/10 shrink-0" />
                  )}
                  {visibleLinks.map(l => {
                    const dropdownActive = Array.isArray(l.dropdown)
                      && l.dropdown.some((item) => item.to && item.to !== '#' && loc.pathname === item.to)
                    const active = loc.pathname === l.to || dropdownActive
                    const navClasses = `group va-body inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-medium whitespace-nowrap transition-all ${
                      active
                        ? 'border-gold/28 bg-gold/12 text-gold-soft shadow-[0_12px_25px_-18px_rgba(244,183,64,0.7)]'
                        : 'border-transparent bg-white/[0.02] text-white/78 hover:border-gold/14 hover:bg-white/[0.05] hover:text-white'
                    }`
                    if (l.dropdown) {
                      return (
                        <div key={l.to}
                          onMouseEnter={(e) => handleDdEnter(l.to, e.currentTarget)}
                          onMouseLeave={handleDdLeave}>
                          <Link to={l.to}
                            className={navClasses}>
                            <span className={`transition-colors ${active ? 'text-gold' : 'text-gold/70 group-hover:text-gold-soft'}`}>
                              {renderNavIcon(l.label)}
                            </span>
                            <span>{l.label}</span>
                            <svg className="w-2.5 h-2.5 opacity-60" viewBox="0 0 10 10" fill="none">
                              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </Link>
                        </div>
                      )
                    }
                    return (
                      <Link
                        key={l.to}
                        to={l.to}
                        className={navClasses}
                      >
                        <span className={`transition-colors ${active ? 'text-gold' : 'text-gold/70 group-hover:text-gold-soft'}`}>
                          {renderNavIcon(l.label)}
                        </span>
                        <span>{l.label}</span>
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
        <div className="border-b border-gold/10 bg-black/10">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-xs uppercase tracking-[0.18em] text-gold/60">Sponsors</span>
            {sponsors.map((s, i) => (
              s?.url ? <img key={i} src={s.url} alt={s.name || ''} title={s.name || ''} className="h-6 sm:h-7 object-contain" /> : null
            ))}
          </div>
        </div>
      )}

      {openDropdown && createPortal(
        <div
          style={{ position: 'fixed', top: ddPos.top, left: ddPos.left, zIndex: 9999 }}
          className="rounded-xl border border-gold/15 bg-[#0b1312] shadow-card overflow-hidden min-w-[11rem] py-1"
          onMouseEnter={handleDdPanelEnter}
          onMouseLeave={handleDdLeave}
        >
          {NAV_GROUPS.flatMap(g => g.links).find(l => l.to === openDropdown)?.dropdown?.map(item => {
            const to = item.to
              ? item.to
              : `/players?tab=${encodeURIComponent(item.tab)}`
            if (item.disabled) {
              return (
                <span
                  key={item.label}
                  className="va-body flex items-center px-4 py-2.5 text-white/35 cursor-not-allowed"
                >
                  {item.label}
                </span>
              )
            }
            return (
              <Link
                key={item.label}
                to={to}
                onClick={() => setOpenDropdown(null)}
                className="va-body flex items-center px-4 py-2.5 text-[#d8e2df] hover:bg-black/20 hover:text-white transition gap-2"
              >
                {item.label}
              </Link>
            )
          })}
        </div>,
        document.body
      )}
      <main className="max-w-7xl mx-auto p-3 sm:p-4">{children}</main>
      <footer className="border-t border-gold/10 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1">
          <p className="va-micro text-gold/55">
            {footerVersion} · Developed by Sunny Mantri for South West Hitters Cricket Club
          </p>
          <p className="va-micro text-white/35">
            ABN 56 495 977 829
          </p>
        </div>
      </footer>
    </div>
  )
}
