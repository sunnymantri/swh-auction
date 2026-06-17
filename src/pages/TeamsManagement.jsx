import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { createTeam, deleteTeam, listTeams, listTeamSummaries, listPlayers, updateTeam, uploadTeamLogo, uploadBranding } from '../lib/api'
import { fmtPoints } from '../lib/format'

const blankFor = (auction) => ({
  name: '', short_name: '',
  total_budget: auction?.default_team_budget ?? 100000,
  max_players: auction?.squad_size ?? 11,
  logo_url: '', sponsor_logo_url: ''
})

export default function TeamsManagement() {
  const { auction } = useActiveAuction()
  const [teams, setTeams] = useState([])
  const [summaries, setSummaries] = useState([])
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState(blankFor(null))
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)

  const reload = async () => {
    if (!auction) return
    const [t, s, p] = await Promise.all([
      listTeams(auction.id),
      listTeamSummaries(auction.id),
      listPlayers(auction.id)
    ])
    setTeams(t)
    setSummaries(s)
    setPlayers(p)
  }
  useEffect(() => { reload() }, [auction])
  useEffect(() => { if (!editId) setForm(blankFor(auction)) }, [auction, editId])

  const calculatedBudget = useMemo(() => {
    const readyPlayers = players.filter((p) => p.status === 'ready_for_auction')
    // Formula: total ready base_price × multiplier ÷ number of teams.
    const totalBasePrice = readyPlayers.reduce((sum, p) => sum + (p.base_price || 0), 0)
    const multiplier = auction?.budget_multiplier ?? 1.6
    const numTeams = teams.length || 1
    return Math.round((totalBasePrice * multiplier) / numTeams)
  }, [players, teams, auction])

  const displayTeams = useMemo(() => teams.map(t => ({
    ...t, ...(summaries.find(s => s.id === t.id) ?? {})
  })), [teams, summaries])

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

  return (
    <AppShell title="Teams Management">
      <RoleGate allow={['admin']}>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
            <h3 className="va-section-title text-teal-200">{editId ? 'Edit team' : 'Create team'}</h3>
            {[
              ['name', 'Team name'], ['short_name', 'Short name']
            ].map(([f, label]) => (
              <input key={f} placeholder={label} value={form[f] ?? ''}
                onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                className="va-body w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="va-micro text-teal-300">Budget
                <input value={form.total_budget} inputMode="numeric"
                  onChange={(e) => setForm((s) => ({ ...s, total_budget: Number(e.target.value.replace(/[^\d]/g, '') || 0) }))}
                  className="va-body w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              </label>
              <label className="va-micro text-teal-300">Max players
                <input value={form.max_players} inputMode="numeric"
                  onChange={(e) => setForm((s) => ({ ...s, max_players: Number(e.target.value.replace(/[^\d]/g, '') || 0) }))}
                  className="va-body w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              </label>
            </div>
            <label className="va-micro block text-teal-300">Team logo
              <input type="file" accept="image/*" className="va-micro mt-1 block"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setUploadBusy(true)
                  try {
                    const url = await uploadTeamLogo(f)
                    setForm((s) => ({ ...s, logo_url: url }))
                  } catch (err) {
                    setMsg(`Team logo upload failed: ${err.message}`)
                  } finally {
                    setUploadBusy(false)
                  }
                }} />
            </label>
            <label className="va-micro block text-teal-300">Sponsor logo
              <input type="file" accept="image/*" className="va-micro mt-1 block"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setUploadBusy(true)
                  try {
                    const url = await uploadBranding(f)
                    setForm((s) => ({ ...s, sponsor_logo_url: url }))
                  } catch (err) {
                    setMsg(`Sponsor logo upload failed: ${err.message}`)
                  } finally {
                    setUploadBusy(false)
                  }
                }} />
            </label>
            <div className="flex gap-3 mt-1">
              <button onClick={save} disabled={!form.name || saving || uploadBusy}
                className="flex-1 px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50">
                {saving ? 'Saving…' : 'Save team'}
              </button>
              {editId && (
                <button onClick={() => { setEditId(null); setForm(blankFor(auction)) }}
                  className="flex-1 px-4 py-2 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white hover:border-teal-500 font-semibold transition">
                  Cancel
                </button>
              )}
            </div>
            {msg && <p className="va-support text-live">{msg}</p>}
          </div>

          <div className="xl:col-span-2 rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
            <h3 className="va-section-title mb-2 text-teal-200">Teams ({teams.length})</h3>
            {/* Calculated budget info */}
            <div className="va-micro mb-3 rounded-lg border border-teal-700/30 bg-ink-900/40 p-3 flex flex-wrap gap-x-6 gap-y-1 text-teal-300">
              <span>Ready for auction: <b className="text-white">{players.filter((p) => p.status === 'ready_for_auction').length}</b></span>
              <span>Total base-price pool: <b className="text-white">{fmtPoints(players.filter((p) => p.status === 'ready_for_auction').reduce((s, p) => s + (p.base_price || 0), 0))}</b></span>
              <span>Multiplier: <b className="text-white">{auction?.budget_multiplier ?? 1.6}x</b></span>
              <span>Suggested team budget: <b className="text-gold">{fmtPoints(calculatedBudget)}</b></span>
            </div>
            <div className="space-y-2">
              {displayTeams.map((t) => (
                <div key={t.id}
                  onClick={() => { setEditId(t.id); setForm({ ...blankFor(auction), ...t }) }}
                  className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 cursor-pointer transition ${editId === t.id ? 'border-gold/50 bg-gold/5' : 'border-teal-700/40 hover:border-teal-600/60'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-ink-900 border border-teal-700/40 grid place-items-center overflow-hidden shrink-0">
                      {t.logo_url ? <img src={t.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="va-micro text-teal-500">{t.short_name}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="va-body font-medium text-white truncate">{t.name} <span className="va-micro text-teal-500">({t.short_name})</span></p>
                      <p className="va-micro text-teal-400 mt-0.5 truncate">
                        Owner: <span className="text-teal-200">{t.owner_name || '—'}</span>
                        {' · '}{t.players_count ?? 0}/{t.squad_size ?? t.max_players} players
                        {' · '}{fmtPoints(t.points_remaining ?? t.total_budget)} left
                      </p>
                      <p className="va-micro mt-0.5">
                        {t.owner_user_id
                          ? <span className="text-teal-400">✓ Linked</span>
                          : <span className="text-teal-600">No login — assign in Users</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setEditId(t.id); setForm({ ...blankFor(auction), ...t }) }} className="va-micro px-2 py-1 rounded bg-teal-700/50">Edit</button>
                    <button onClick={async (e) => {
                      e.stopPropagation()
                      if (!window.confirm(`Delete team "${t.name}"? This cannot be undone.`)) return
                      await deleteTeam(t.id); reload()
                    }} className="va-micro px-2 py-1 rounded bg-live/40">Delete</button>
                  </div>
                </div>
              ))}
              {displayTeams.length === 0 && <p className="va-support text-teal-500">No teams yet.</p>}
            </div>
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}
