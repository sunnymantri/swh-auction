import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { createTeam, deleteTeam, listTeams, updateTeam, uploadTeamLogo, uploadBranding } from '../lib/api'
import { createUserAccount, resetUserPassword } from '../lib/admin'
import { fmtPoints } from '../lib/format'

const blankFor = (auction) => ({
  name: '', short_name: '', owner_name: '', owner_email: '',
  total_budget: auction?.default_team_budget ?? 100000,
  max_players: auction?.squad_size ?? 11,
  logo_url: '', sponsor_logo_url: ''
})

export default function TeamsManagement() {
  const { auction } = useActiveAuction()
  const [teams, setTeams] = useState([])
  const [form, setForm] = useState(blankFor(null))
  const [editId, setEditId] = useState(null)
  const [creds, setCreds] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    if (!auction) return
    setTeams(await listTeams(auction.id))
  }
  useEffect(() => { reload() }, [auction])
  useEffect(() => { if (!editId) setForm(blankFor(auction)) }, [auction, editId])

  if (!auction) {
    return (
      <AppShell title="Teams Management">
        <RoleGate allow={['admin']}>
          <p className="text-teal-400">No auction selected. Create or select one on the Auctions screen.</p>
        </RoleGate>
      </AppShell>
    )
  }

  const save = async () => {
    setMsg('')
    setSaving(true)
    const payload = {
      name: form.name, short_name: form.short_name,
      owner_name: form.owner_name, owner_email: form.owner_email,
      total_budget: Number(form.total_budget || 0),
      max_players: Number(form.max_players || 0),
      logo_url: form.logo_url || null,
      sponsor_logo_url: form.sponsor_logo_url || null,
      auction_id: auction.id
    }
    try {
      if (editId) await updateTeam(editId, payload)
      else await createTeam(payload)
      setEditId(null)
      setForm(blankFor(auction))
      await reload()
    } catch (e) {
      setMsg(e.message || 'Save failed — check the browser console for details.')
    } finally {
      setSaving(false)
    }
  }

  const createOwner = async (team) => {
    setMsg(''); setCreds(null)
    if (!team.owner_email) { setMsg('Set an owner email on the team first.'); return }
    try {
      const res = await createUserAccount({
        email: team.owner_email,
        fullName: team.owner_name || team.name,
        role: 'team_owner',
        teamId: team.id
      })
      setCreds({ team: team.name, ...res })
      await reload()
    } catch (e) {
      setMsg(e.message)
    }
  }

  const resetPassword = async (team) => {
    setMsg(''); setCreds(null)
    if (!team.owner_user_id) { setMsg('No linked owner for this team.'); return }
    try {
      const res = await resetUserPassword(team.owner_user_id)
      setCreds({ team: team.name, email: team.owner_email, password: res.password })
    } catch (e) {
      setMsg(e.message)
    }
  }

  return (
    <AppShell title="Teams Management">
      <RoleGate allow={['admin']}>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
            <h3 className="font-score text-lg text-teal-200">{editId ? 'Edit team' : 'Create team'}</h3>
            {[
              ['name', 'Team name'], ['short_name', 'Short name'],
              ['owner_name', 'Owner name'], ['owner_email', 'Owner email']
            ].map(([f, label]) => (
              <input key={f} placeholder={label} value={form[f] ?? ''}
                onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
            ))}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-teal-300">Budget
                <input value={form.total_budget} inputMode="numeric"
                  onChange={(e) => setForm((s) => ({ ...s, total_budget: Number(e.target.value.replace(/[^\d]/g, '') || 0) }))}
                  className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              </label>
              <label className="text-xs text-teal-300">Max players
                <input value={form.max_players} inputMode="numeric"
                  onChange={(e) => setForm((s) => ({ ...s, max_players: Number(e.target.value.replace(/[^\d]/g, '') || 0) }))}
                  className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              </label>
            </div>
            <label className="block text-xs text-teal-300">Team logo
              <input type="file" accept="image/*" className="mt-1 block text-xs"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const url = await uploadTeamLogo(f)
                  setForm((s) => ({ ...s, logo_url: url }))
                }} />
            </label>
            <label className="block text-xs text-teal-300">Sponsor logo
              <input type="file" accept="image/*" className="mt-1 block text-xs"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const url = await uploadBranding(f)
                  setForm((s) => ({ ...s, sponsor_logo_url: url }))
                }} />
            </label>
            <button onClick={save} disabled={!form.name || saving}
              className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : 'Save team'}
            </button>
            {editId && <button onClick={() => { setEditId(null); setForm(blankFor(auction)) }} className="ml-2 text-xs text-teal-300">Cancel edit</button>}
            {msg && <p className="text-live text-sm">{msg}</p>}
            {creds && (
              <div className="rounded-lg border border-teal-600/50 bg-teal-900/30 p-3 text-sm">
                <p className="text-teal-200 font-semibold">Owner login for {creds.team}:</p>
                <p className="text-white">Email: <span className="tabular">{creds.email}</span></p>
                <p className="text-white">Password: <span className="tabular">{creds.password}</span></p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
            <h3 className="font-score text-lg text-teal-200 mb-2">Teams ({teams.length})</h3>
            <div className="space-y-2">
              {teams.map((t) => (
                <div key={t.id} className="border border-teal-700/40 rounded-lg p-3 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-ink-900 border border-teal-700/40 grid place-items-center overflow-hidden shrink-0">
                      {t.logo_url ? <img src={t.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[0.6rem] text-teal-500">{t.short_name}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white truncate">{t.name} <span className="text-teal-500 text-xs">({t.short_name})</span></p>
                      <p className="text-xs text-teal-300 truncate">
                        {t.owner_email || 'no owner email'} · {fmtPoints(t.total_budget)}
                        {t.owner_user_id ? ' · login ✓' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {t.owner_user_id ? (
                      <>
                        <span className="px-2 py-1 text-xs rounded bg-teal-600/60 opacity-60">Linked</span>
                        <button onClick={() => resetPassword(t)}
                          className="px-2 py-1 text-xs rounded bg-gold/30 text-gold hover:bg-gold/50 transition" title="Generate a new password for this owner">
                          Reset password
                        </button>
                      </>
                    ) : (
                      <button onClick={() => createOwner(t)}
                        className="px-2 py-1 text-xs rounded bg-teal-600/60" title="Create owner login">
                        Create login
                      </button>
                    )}
                    <button onClick={() => { setEditId(t.id); setForm({ ...blankFor(auction), ...t }) }} className="px-2 py-1 text-xs rounded bg-teal-700/50">Edit</button>
                    <button onClick={async () => { await deleteTeam(t.id); reload() }} className="px-2 py-1 text-xs rounded bg-live/40">Delete</button>
                  </div>
                </div>
              ))}
              {teams.length === 0 && <p className="text-teal-500 text-sm">No teams yet.</p>}
            </div>
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}
