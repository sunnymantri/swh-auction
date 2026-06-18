import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { createUserAccount, deleteUserAccount, listAuthUsers, listProfiles, resetUserPassword, setProfileRole, updateUserProfile, uploadUserPhoto } from '../lib/admin'
import { listPlayers, listTeams, updateTeam } from '../lib/api'

const ROLES = ['admin', 'team_owner', 'public']
const ROLE_LABELS = { admin: 'Administrator', team_owner: 'Team Owner', public: 'Player' }

export default function UserManagement() {
  const { auction } = useActiveAuction()
  const [profiles, setProfiles] = useState([])
  const [authUsers, setAuthUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState({ email: '', fullName: '', role: 'team_owner', teamId: '', isBidder: false })
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', photo_url: '', role: 'public', teamId: '', isBidder: false })
  const [savingEdit, setSavingEdit] = useState(false)
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false)
  const [resetCreds, setResetCreds] = useState(null)
  const [resettingId, setResettingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [sortBy, setSortBy] = useState('user')
  const [sortDir, setSortDir] = useState('asc')

  const reload = async () => {
    const [p, a] = await Promise.all([listProfiles(), listAuthUsers()])
    setProfiles(p)
    setAuthUsers(a)
    if (auction) {
      const [teamRows, playerRows] = await Promise.all([listTeams(auction.id), listPlayers(auction.id)])
      setTeams(teamRows)
      setPlayers(playerRows)
    }
  }
  useEffect(() => { reload() }, [auction])

  const playersByEmail = useMemo(() => {
    const map = new Map()
    players.forEach((player) => {
      const email = (player.email || '').trim().toLowerCase()
      if (email && player.photo_url && !map.has(email)) {
        map.set(email, player)
      }
    })
    return map
  }, [players])

  const submit = async () => {
    setBusy(true); setError(''); setCreated(null); setResetCreds(null)
    try {
      const res = await createUserAccount({
        email: form.email,
        fullName: form.fullName,
        role: form.role,
        teamId: form.role === 'team_owner' && form.teamId ? form.teamId : null,
        isBidder: form.role === 'team_owner' && form.teamId ? !!form.isBidder : false
      })
      setCreated(res)
      setForm({ email: '', fullName: '', role: 'team_owner', teamId: '', isBidder: false })
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openCreateModal = () => {
    setError('')
    setCreated(null)
    setResetCreds(null)
    setForm({ email: '', fullName: '', role: 'team_owner', teamId: '', isBidder: false })
    setShowCreateModal(true)
  }

  const filteredProfiles = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    if (!term) return profiles
    return profiles.filter((p) => {
      const linkedTeam = teams.find((t) => t.id === p.team_id) || teams.find((t) => t.owner_user_id === p.id)
      const authEmail = authUsers.find((u) => u.user_id === p.user_id)?.email || ''
      const haystack = `${p.full_name || ''} ${ROLE_LABELS[p.role] || p.role || ''} ${authEmail} ${linkedTeam?.name || ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [profiles, userSearch, teams, authUsers])

  const sortedProfiles = useMemo(() => {
    const rows = [...filteredProfiles]
    const getValue = (profile) => {
      const linkedTeam = teams.find((t) => t.id === profile.team_id) || teams.find((t) => t.owner_user_id === profile.id)
      const authEmail = authUsers.find((u) => u.user_id === profile.user_id)?.email || ''
      switch (sortBy) {
        case 'role':
          return ROLE_LABELS[profile.role] || profile.role || ''
        case 'email':
          return authEmail
        case 'team':
          return linkedTeam?.name || ''
        case 'user':
        default:
          return profile.full_name || ''
      }
    }
    rows.sort((a, b) => {
      const av = String(getValue(a)).toLowerCase()
      const bv = String(getValue(b)).toLowerCase()
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [filteredProfiles, teams, authUsers, sortBy, sortDir])

  const onSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortDir('asc')
  }

  const changeRole = async (id, role) => {
    await setProfileRole(id, role)
    await reload()
  }

  const startEdit = (profile) => {
    const linkedTeam = teams.find((t) => t.id === profile.team_id) || teams.find((t) => t.owner_user_id === profile.id)
    const authEmail = authUsers.find((u) => u.user_id === profile.user_id)?.email || ''
    const linkedPlayer = authEmail ? playersByEmail.get(authEmail.trim().toLowerCase()) : null
    setEditId(profile.id)
    setEditForm({
      full_name: profile.full_name || '',
      photo_url: profile.photo_url || linkedPlayer?.photo_url || '',
      role: profile.role || 'public',
      teamId: linkedTeam?.id || '',
      isBidder: Boolean(linkedTeam?.owner_user_id === profile.id)
    })
    setShowEditModal(true)
  }

  const saveEdit = async () => {
    if (!editId) return
    setSavingEdit(true)
    setError('')
    try {
      const nextTeamId = editForm.role === 'team_owner' ? (editForm.teamId || null) : null
      const currentBidderTeam = teams.find((t) => t.owner_user_id === editId) || null
      const nextBidderTeam = nextTeamId ? teams.find((t) => t.id === nextTeamId) || null : null
      await updateUserProfile(editId, {
        full_name: editForm.full_name || null,
        photo_url: editForm.photo_url || null,
        role: editForm.role,
        team_id: nextTeamId
      })

      if (currentBidderTeam && (!editForm.isBidder || currentBidderTeam.id !== nextTeamId)) {
        await updateTeam(currentBidderTeam.id, { owner_user_id: null })
      }
      if (editForm.role === 'team_owner' && nextTeamId && editForm.isBidder) {
        if (nextBidderTeam?.owner_user_id && nextBidderTeam.owner_user_id !== editId) {
          await updateTeam(nextTeamId, { owner_user_id: null })
        }
        await updateTeam(nextTeamId, { owner_user_id: editId })
      }
      setEditId(null)
      setShowEditModal(false)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleResetPassword = async (profileId, email) => {
    setResettingId(profileId); setError(''); setResetCreds(null)
    try {
      const res = await resetUserPassword(profileId)
      setResetCreds({ profileId, email: res.email || email, password: res.password })
    } catch (e) { setError(e.message) }
    finally { setResettingId(null) }
  }

  const handleDeleteUser = async (profileId, nameOrEmail) => {
    if (!window.confirm(`Delete user "${nameOrEmail}"? This removes auth access and profile.`)) return
    setDeletingId(profileId); setError(''); setResetCreds(null)
    try {
      await deleteUserAccount(profileId)
      if (editId === profileId) {
        setEditId(null)
        setShowEditModal(false)
      }
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppShell title="User Management">
      <RoleGate allow={['admin']}>
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 font-sans text-sm">
          <div className="mb-5 flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink-900"
            >
              Create user
            </button>
            <h3 className="va-section-title text-teal-200">Users</h3>
          </div>
          <div className="mb-5">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by name, email, role, or team..."
              className="w-full rounded-lg border border-teal-700/50 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-teal-600"
            />
          </div>
          {error && <p className="text-live text-sm mb-2">{error}</p>}
          <div className="space-y-2 max-h-[65vh] overflow-y-auto">
            <div className="hidden lg:grid lg:grid-cols-[1.2fr_0.9fr_1.4fr_1fr_1.4fr] gap-3 px-3 py-2 rounded-lg border border-teal-700/40 bg-ink-900/50 text-xs uppercase tracking-[0.12em] text-teal-400">
              <button onClick={() => onSort('user')} className="text-left hover:text-teal-200 transition">User</button>
              <button onClick={() => onSort('role')} className="text-left hover:text-teal-200 transition">Role</button>
              <button onClick={() => onSort('email')} className="text-left hover:text-teal-200 transition">Email</button>
              <button onClick={() => onSort('team')} className="text-left hover:text-teal-200 transition">Team</button>
              <span className="text-right">Actions</span>
            </div>
            {sortedProfiles.map((p) => {
              const linkedTeam = teams.find(t => t.id === p.team_id) || teams.find(t => t.owner_user_id === p.id)
              const isBidderForTeam = Boolean(linkedTeam && linkedTeam.owner_user_id === p.id)
              const authEmail = authUsers.find((u) => u.user_id === p.user_id)?.email || ''
              const linkedPlayer = authEmail ? playersByEmail.get(authEmail.trim().toLowerCase()) : null
              const profilePhoto = p.photo_url || linkedPlayer?.photo_url || ''
              return (
                <div key={p.id} className="border border-teal-700/40 rounded-lg overflow-hidden">
                  <div className="p-3 grid gap-2 lg:grid-cols-[1.2fr_0.9fr_1.4fr_1fr_1.4fr] lg:items-center lg:gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-ink-900 border border-teal-700/40 overflow-hidden shrink-0">
                          {profilePhoto
                            ? <img src={profilePhoto} alt="" className="h-full w-full object-cover" />
                            : null}
                        </div>
                        <span className="font-medium text-white truncate">{p.full_name || '—'}</span>
                      </div>
                    <div className="text-teal-300">{ROLE_LABELS[p.role] ?? p.role}</div>
                    <div className="text-teal-400 truncate">{authEmail || 'Auth email unavailable'}</div>
                    <div className="text-teal-300">
                      {p.role === 'team_owner'
                        ? (linkedTeam
                          ? <span className="inline-flex items-center gap-1.5">{linkedTeam.logo_url && <img src={linkedTeam.logo_url} alt="" className="h-4 w-4 rounded object-cover shrink-0" />}<span>{linkedTeam.name}</span>{isBidderForTeam && <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] text-gold">Bidder</span>}</span>
                          : <span className="text-teal-600">No team linked</span>)
                        : <span className="text-teal-600">—</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 justify-start lg:justify-end">
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded-lg bg-teal-700 px-2 py-1 text-xs text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleResetPassword(p.id, authEmail || p.full_name || '—')}
                        disabled={resettingId === p.id}
                        className="rounded-lg bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        {resettingId === p.id ? 'Resetting…' : 'Reset password'}
                      </button>
                      <select value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}
                        className="rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1 text-xs text-white">
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                      </select>
                      <button
                        onClick={() => handleDeleteUser(p.id, authEmail || p.full_name || 'user')}
                        disabled={deletingId === p.id}
                        className="rounded-lg bg-gold/80 px-2 py-1 text-xs text-ink-900 disabled:opacity-50"
                      >
                        {deletingId === p.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {resetCreds?.profileId === p.id && (
                    <div className="border-t border-teal-700/40 bg-teal-900/20 px-3 py-2">
                      <p className="va-micro text-teal-200 font-semibold mb-1">New credentials for {p.full_name || resetCreds.email}:</p>
                      <p className="va-micro text-white">Email: <span className="tabular">{resetCreds.email}</span></p>
                      <p className="va-micro text-white">Password: <span className="tabular font-mono">{resetCreds.password}</span></p>
                      <p className="va-micro text-teal-500 mt-1">Ask the user to change this password after first login.</p>
                      <button onClick={() => setResetCreds(null)} className="va-micro text-teal-600 hover:text-teal-400 mt-0.5 transition">Dismiss</button>
                    </div>
                  )}
                </div>
              )
            })}
            {filteredProfiles.length === 0 && <p className="text-sm text-teal-500">No users match your search.</p>}
          </div>
        </div>

        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="w-full max-w-lg rounded-xl border border-teal-700/40 bg-ink-800/95 p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="va-section-title text-teal-200">Create user</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="va-micro rounded-lg border border-teal-700/40 px-2 py-1 text-teal-300 hover:text-white"
                >
                  Close
                </button>
              </div>
              <p className="va-support text-teal-400">
                Create a Supabase login and user profile. For team owners, optionally link a team.
              </p>
              <input placeholder="Email" value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="va-body w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              <input placeholder="Full name" value={form.fullName}
                onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                className="va-body w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              <select value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value, teamId: e.target.value === 'team_owner' ? s.teamId : '', isBidder: e.target.value === 'team_owner' ? s.isBidder : false }))}
                className="va-body w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2">
                <option value="team_owner">Team Owner</option>
                <option value="admin">Administrator</option>
              </select>
              {form.role === 'team_owner' && (
                <>
                  <select value={form.teamId}
                    onChange={(e) => setForm((s) => ({ ...s, teamId: e.target.value, isBidder: e.target.value ? s.isBidder : false }))}
                    className="va-body w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2">
                    <option value="">Link to team (optional)…</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {form.teamId && (
                    <label className="va-body inline-flex items-center gap-2 text-teal-200">
                      <input
                        type="checkbox"
                        checked={!!form.isBidder}
                        onChange={(e) => setForm((s) => ({ ...s, isBidder: e.target.checked }))}
                      />
                      Set as bidder for this team
                    </label>
                  )}
                </>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-teal-700/40 px-3 py-2 text-sm text-teal-200"
                >
                  Cancel
                </button>
                <button onClick={submit} disabled={busy || !form.email}
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink-900 disabled:opacity-50">
                  {busy ? 'Saving…' : 'Save user'}
                </button>
              </div>
              {created && (
                <div className="rounded-lg border border-teal-600/50 bg-teal-900/30 p-3 text-sm">
                  <p className="va-body mb-1 font-semibold text-teal-200">Account created — share these credentials:</p>
                  <p className="text-white">Email: <span className="tabular">{created.email}</span></p>
                  <p className="text-white">Password: <span className="tabular">{created.password}</span></p>
                  <p className="va-micro mt-1 text-teal-400">Role: {ROLE_LABELS[created.role] ?? created.role}</p>
                  <p className="va-micro mt-1 text-teal-400">Ask the user to change this password right after first login.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {showEditModal && editId && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => { setShowEditModal(false); setEditId(null) }}
          >
            <div
              className="w-full max-w-xl rounded-xl border border-teal-700/40 bg-ink-800/95 p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="va-section-title text-teal-200">Edit user</h3>
                <button
                  onClick={() => { setShowEditModal(false); setEditId(null) }}
                  className="rounded-lg border border-teal-700/40 px-2 py-1 text-sm text-teal-300 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((s) => ({ ...s, full_name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-sm text-white"
                />
                <input
                  value={editForm.photo_url}
                  onChange={(e) => setEditForm((s) => ({ ...s, photo_url: e.target.value }))}
                  placeholder="Photo URL"
                  className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <label className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3 py-2 text-sm text-white cursor-pointer">
                  {uploadingEditPhoto ? 'Uploading…' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingEditPhoto}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setUploadingEditPhoto(true)
                      setError('')
                      try {
                        const url = await uploadUserPhoto(f)
                        setEditForm((s) => ({ ...s, photo_url: url }))
                      } catch (err) {
                        setError(err.message)
                      } finally {
                        setUploadingEditPhoto(false)
                      }
                    }}
                  />
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((s) => ({ ...s, role: e.target.value, teamId: e.target.value === 'team_owner' ? s.teamId : '', isBidder: e.target.value === 'team_owner' ? s.isBidder : false }))}
                  className="rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-sm text-white"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                </select>
                {editForm.role === 'team_owner' ? (
                  <div className="space-y-2">
                    <select
                      value={editForm.teamId}
                      onChange={(e) => setEditForm((s) => ({ ...s, teamId: e.target.value, isBidder: e.target.value ? s.isBidder : false }))}
                      className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Link to team (optional)…</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {editForm.teamId && (
                      <label className="inline-flex items-center gap-2 text-xs text-teal-200">
                        <input
                          type="checkbox"
                          checked={!!editForm.isBidder}
                          onChange={(e) => setEditForm((s) => ({ ...s, isBidder: e.target.checked }))}
                        />
                        Set as bidder for this team
                      </label>
                    )}
                  </div>
                ) : <div />}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => { setShowEditModal(false); setEditId(null) }}
                  className="rounded-lg border border-teal-700/40 px-3 py-2 text-sm text-teal-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit || uploadingEditPhoto}
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink-900 disabled:opacity-50"
                >
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
