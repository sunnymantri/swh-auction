import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { createUserAccount, listProfiles, setProfileRole } from '../lib/admin'
import { listTeams } from '../lib/api'

const ROLES = ['admin', 'team_owner', 'public']

export default function UserManagement() {
  const { auction } = useActiveAuction()
  const [profiles, setProfiles] = useState([])
  const [teams, setTeams] = useState([])
  const [form, setForm] = useState({ email: '', fullName: '', role: 'team_owner', teamId: '' })
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setProfiles(await listProfiles())
    if (auction) setTeams(await listTeams(auction.id))
  }
  useEffect(() => { reload() }, [auction])

  const submit = async () => {
    setBusy(true); setError(''); setCreated(null)
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
              <option value="team_owner">Team owner</option>
              <option value="admin">Admin</option>
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
                <p className="text-teal-400 text-xs mt-1">Role: {created.role}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
            <h3 className="font-score text-lg text-teal-200 mb-2">Existing users</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {profiles.map((p) => (
                <div key={p.id} className="border border-teal-700/40 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-white truncate">{p.full_name || '—'}</p>
                    <p className="text-xs text-teal-400">{p.role}</p>
                  </div>
                  <select value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}
                    className="rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1 text-xs">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ))}
              {profiles.length === 0 && <p className="text-teal-500 text-sm">No profiles yet.</p>}
            </div>
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}
