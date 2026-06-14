import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { createUserAccount, listAuthUsers, listProfiles, resetUserPassword, setProfileRole, updateUserProfile, uploadUserPhoto } from '../lib/admin'
import { listTeams, updateTeam } from '../lib/api'

const ROLES = ['admin', 'team_owner', 'public']
const ROLE_LABELS = { admin: 'Administrator', team_owner: 'Team Owner', public: 'Player' }

export default function UserManagement() {
  const { auction } = useActiveAuction()
  const [profiles, setProfiles] = useState([])
  const [authUsers, setAuthUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [form, setForm] = useState({ email: '', fullName: '', role: 'team_owner', teamId: '' })
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', photo_url: '', role: 'public', teamId: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false)
  const [resetCreds, setResetCreds] = useState(null)
  const [resettingId, setResettingId] = useState(null)

  const reload = async () => {
    const [p, a] = await Promise.all([listProfiles(), listAuthUsers()])
    setProfiles(p)
    setAuthUsers(a)
    if (auction) setTeams(await listTeams(auction.id))
  }
  useEffect(() => { reload() }, [auction])

  const submit = async () => {
    setBusy(true); setError(''); setCreated(null); setResetCreds(null)
    try {
      const res = await createUserAccount({
        email: form.email,
        fullName: form.fullName,
        role: form.role,
        teamId: form.role === 'team_owner' && form.teamId ? form.teamId : null
      })
      setCreated(res)
      setForm({ email: '', fullName: '', role: 'team_owner', teamId: '' })
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (id, role) => {
    await setProfileRole(id, role)
    await reload()
  }

  const startEdit = (profile) => {
    const linkedTeam = teams.find((t) => t.owner_user_id === profile.id)
    setEditId(profile.id)
    setEditForm({
      full_name: profile.full_name || '',
      photo_url: profile.photo_url || '',
      role: profile.role || 'public',
      teamId: linkedTeam?.id || ''
    })
  }

  const saveEdit = async () => {
    if (!editId) return
    setSavingEdit(true)
    setError('')
    try {
      await updateUserProfile(editId, {
        full_name: editForm.full_name || null,
        photo_url: editForm.photo_url || null,
        role: editForm.role
      })
      // Keep team-owner linkage consistent with edited role/team selection.
      const currentlyLinked = teams.filter((t) => t.owner_user_id === editId)
      for (const t of currentlyLinked) {
        await updateTeam(t.id, { owner_user_id: null })
      }
      if (editForm.role === 'team_owner' && editForm.teamId) {
        await updateTeam(editForm.teamId, { owner_user_id: editId })
      }
      setEditId(null)
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

  return (
    <AppShell title="User Management">
      <RoleGate allow={['admin']}>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-3">
            <h3 className="font-score text-lg text-teal-200">Create login</h3>
            <p className="text-xs text-teal-400">
              Creates a Supabase account (email + generated password) and a profile.
              For team owners you can link them to a team so they can only bid for that team.
            </p>
            <input placeholder="Email" value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
            <input placeholder="Full name" value={form.fullName}
              onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
              className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
            <select value={form.role}
              onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
              className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2">
              <option value="team_owner">Team Owner</option>
              <option value="admin">Administrator</option>
            </select>
            {form.role === 'team_owner' && (
              <select value={form.teamId}
                onChange={(e) => setForm((s) => ({ ...s, teamId: e.target.value }))}
                className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2">
                <option value="">Link to team (optional)…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button onClick={submit} disabled={busy || !form.email}
              className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50">
              {busy ? 'Creating…' : 'Create account'}
            </button>
            {error && <p className="text-live text-sm">{error}</p>}
            {created && (
              <div className="rounded-lg border border-teal-600/50 bg-teal-900/30 p-3 text-sm">
                <p className="text-teal-200 font-semibold mb-1">Account created — share these credentials:</p>
                <p className="text-white">Email: <span className="tabular">{created.email}</span></p>
                <p className="text-white">Password: <span className="tabular">{created.password}</span></p>
                <p className="text-teal-400 text-xs mt-1">Role: {ROLE_LABELS[created.role] ?? created.role}</p>
                <p className="text-teal-400 text-xs mt-1">Ask the user to change this password right after first login.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
            <h3 className="font-score text-lg text-teal-200 mb-2">Existing users</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {profiles.map((p) => {
                const linkedTeam = teams.find(t => t.owner_user_id === p.id)
                const authEmail = authUsers.find((u) => u.user_id === p.user_id)?.email || ''
                return (
                  <div key={p.id} className="border border-teal-700/40 rounded-lg overflow-hidden">
                    <div className="p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-ink-900 border border-teal-700/40 overflow-hidden shrink-0">
                            {p.photo_url
                              ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                              : null}
                          </div>
                          <p className="text-white truncate">{p.full_name || '—'}</p>
                        </div>
                        <p className="text-xs text-teal-400">{ROLE_LABELS[p.role] ?? p.role}</p>
                        <p className="text-[0.65rem] text-teal-500 truncate">{authEmail || 'Auth email unavailable'}</p>
                        {p.role === 'team_owner' && (
                          linkedTeam ? (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {linkedTeam.logo_url && <img src={linkedTeam.logo_url} alt="" className="h-4 w-4 rounded object-cover shrink-0" />}
                              <span className="text-[0.65rem] text-teal-300">{linkedTeam.name}</span>
                            </div>
                          ) : (
                            <p className="text-[0.65rem] text-teal-600 mt-0.5">No team linked</p>
                          )
                        )}
                        {editId === p.id && (
                          <div className="mt-2 space-y-2">
                            <input
                              value={editForm.full_name}
                              onChange={(e) => setEditForm((s) => ({ ...s, full_name: e.target.value }))}
                              placeholder="Full name"
                              className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1 text-xs"
                            />
                            <input
                              value={editForm.photo_url}
                              onChange={(e) => setEditForm((s) => ({ ...s, photo_url: e.target.value }))}
                              placeholder="Photo URL"
                              className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1 text-xs"
                            />
                            <label className="inline-flex items-center text-xs px-2 py-1 rounded bg-teal-700/40 cursor-pointer">
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
                              onChange={(e) => setEditForm((s) => ({ ...s, role: e.target.value, teamId: e.target.value === 'team_owner' ? s.teamId : '' }))}
                              className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1 text-xs"
                            >
                              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                            </select>
                            {editForm.role === 'team_owner' && (
                              <select
                                value={editForm.teamId}
                                onChange={(e) => setEditForm((s) => ({ ...s, teamId: e.target.value }))}
                                className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1 text-xs"
                              >
                                <option value="">Link to team (optional)…</option>
                                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => editId === p.id ? setEditId(null) : startEdit(p)}
                          className="rounded-lg bg-teal-700/40 border border-teal-700/50 px-2 py-1 text-xs text-teal-100"
                        >
                          {editId === p.id ? 'Cancel' : 'Edit'}
                        </button>
                        {editId === p.id && (
                          <button
                            onClick={saveEdit}
                            disabled={savingEdit || uploadingEditPhoto}
                            className="rounded-lg bg-gold text-ink-900 px-2 py-1 text-xs font-semibold disabled:opacity-50"
                          >
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                        )}
                        {editId !== p.id && (
                          <button
                            onClick={() => handleResetPassword(p.id, authEmail || p.full_name || '—')}
                            disabled={resettingId === p.id}
                            className="rounded-lg bg-teal-700/40 border border-teal-700/50 px-2 py-1 text-xs text-teal-100 disabled:opacity-50"
                          >
                            {resettingId === p.id ? 'Resetting…' : 'Reset pwd'}
                          </button>
                        )}
                        <select value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}
                          className="rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1 text-xs">
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                        </select>
                      </div>
                    </div>
                    {resetCreds?.profileId === p.id && (
                      <div className="border-t border-teal-700/40 bg-teal-900/20 px-3 py-2">
                        <p className="text-teal-200 font-semibold text-xs mb-1">New credentials for {p.full_name || resetCreds.email}:</p>
                        <p className="text-white text-xs">Email: <span className="tabular">{resetCreds.email}</span></p>
                        <p className="text-white text-xs">Password: <span className="tabular font-mono">{resetCreds.password}</span></p>
                        <p className="text-teal-500 text-[0.65rem] mt-1">Ask the user to change this password after first login.</p>
                        <button onClick={() => setResetCreds(null)} className="text-[0.65rem] text-teal-600 hover:text-teal-400 mt-0.5 transition">Dismiss</button>
                      </div>
                    )}
                  </div>
                )
              })}
              {profiles.length === 0 && <p className="text-teal-500 text-sm">No profiles yet.</p>}
            </div>
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}
