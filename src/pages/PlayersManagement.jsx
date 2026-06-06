import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import {
  createPlayer, deletePlayer, exportPlayersCsv, listPlayers,
  parsePlayersCsvDetailed, playersCsvTemplate, updatePlayer, uploadPlayerPhoto
} from '../lib/api'
import { supabase } from '../lib/supabase'

const blankFor = (auction) => ({
  name: '', role: '', category: '', base_price: auction?.default_base_price ?? 500,
  status: 'approved',
  batting_style: '', bowling_style: '', profile_url: '',
  matches: 0, runs: 0, bat_avg: 0, wickets: 0, catches: 0,
  strike_rate: 0, bowl_avg: 0, economy: 0, photo_url: ''
})

const FIELD_META = [
  { key: 'name',          label: 'Full name',               type: 'text' },
  { key: 'role',          label: 'Role (e.g. Batter / Bowler)', type: 'text' },
  { key: 'category',      label: 'Category',                type: 'text' },
  { key: 'batting_style', label: 'Batting style',           type: 'text' },
  { key: 'bowling_style', label: 'Bowling style',           type: 'text' },
  { key: 'base_price',    label: 'Base price',              type: 'number' },
  { key: 'profile_url',   label: 'Profile URL (CricHeroes)', type: 'text' },
  { key: 'matches',       label: 'Matches played',          type: 'number' },
  { key: 'runs',          label: 'Runs',                    type: 'number' },
  { key: 'bat_avg',       label: 'Batting average',         type: 'number' },
  { key: 'strike_rate',   label: 'Batting strike rate',     type: 'number' },
  { key: 'wickets',       label: 'Wickets',                 type: 'number' },
  { key: 'bowl_avg',      label: 'Bowling average',         type: 'number' },
  { key: 'economy',       label: 'Economy',                 type: 'number' },
  { key: 'catches',       label: 'Catches',                 type: 'number' },
]

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function PlayersManagement() {
  const { auction } = useActiveAuction()
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState(blankFor(null))
  const [editId, setEditId] = useState(null)
  const [report, setReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const reload = async () => {
    if (!auction) return
    setPlayers(await listPlayers(auction.id))
  }
  useEffect(() => { reload() }, [auction])
  useEffect(() => { if (!editId) setForm(blankFor(auction)) }, [auction, editId])

  if (!auction) {
    return (
      <AppShell title="Players Management">
        <RoleGate allow={['admin']}>
          <p className="text-teal-400">No auction selected. Create or select one on the Auctions screen.</p>
        </RoleGate>
      </AppShell>
    )
  }

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))

  const save = async () => {
    setErr(''); setSaving(true)
    try {
      const payload = { ...form, base_price: Number(form.base_price || 0), auction_id: auction.id }
      if (editId) await updatePlayer(editId, payload)
      else await createPlayer(payload)
      setEditId(null)
      setForm(blankFor(auction))
      await reload()
    } catch (e) {
      setErr(e.message || 'Save failed — check browser console.')
    } finally {
      setSaving(false)
    }
  }

  const onPhoto = async (file) => {
    setErr(''); setUploadingPhoto(true)
    try {
      const url = await uploadPlayerPhoto(file)
      set('photo_url', url)
    } catch (e) {
      setErr(`Photo upload failed: ${e.message}`)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const toggleApprove = async (p) => {
    await updatePlayer(p.id, { status: p.status === 'approved' ? 'registered' : 'approved' })
    await reload()
  }

  // Bulk operations
  const toggleSelect = (id) => setSelected((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const selectAll = () => setSelected(
    selected.size === players.length ? new Set() : new Set(players.map((p) => p.id))
  )

  const bulkSetStatus = async (status) => {
    setBulkBusy(true)
    try {
      await Promise.all([...selected].map((id) => updatePlayer(id, { status })))
      setSelected(new Set())
      await reload()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBulkBusy(false)
    }
  }

  const importCsv = async (file) => {
    setReport(null)
    const text = await file.text()
    const { rows, total, skipped, errors } = parsePlayersCsvDetailed(text)
    if (rows.length === 0) {
      setReport({ total, inserted: 0, skipped, failures: errors })
      return
    }
    const failures = [...errors]
    let inserted = 0
    try {
      const payload = rows.map(r => ({ ...r, auction_id: auction.id }))
      const { data, error } = await supabase
        .from('players')
        .insert(payload)
        .select('id')
      if (error) {
        // Batch failed — fall back to row-by-row to identify individual failures
        for (const row of rows) {
          try {
            await createPlayer({ ...row, auction_id: auction.id })
            inserted++
          } catch (e) {
            failures.push(`${row.name}: ${e.message}`)
          }
        }
      } else {
        inserted = data?.length ?? rows.length
      }
    } catch (e) {
      failures.push(`Batch import failed: ${e.message}`)
    }
    setReport({ total, inserted, skipped, failures })
    await reload()
  }

  return (
    <AppShell title="Players Management">
      <RoleGate allow={['admin']}>
        <div className="grid lg:grid-cols-3 gap-4">

          {/* ---- Create / Edit form ---- */}
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-3">
            <h3 className="font-score text-lg text-teal-200">{editId ? 'Edit player' : 'Create player'}</h3>

            {FIELD_META.map(({ key, label, type }) => (
              <label key={key} className="block text-xs text-teal-300">
                {label}
                <input
                  type={type === 'number' ? 'text' : 'text'}
                  inputMode={type === 'number' ? 'numeric' : 'text'}
                  value={form[key] ?? ''}
                  onChange={(e) => set(key, type === 'number'
                    ? Number(e.target.value.replace(/[^\d.]/g, '') || 0)
                    : e.target.value)}
                  className="mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white"
                />
              </label>
            ))}

            <label className="block text-xs text-teal-300">
              Status
              <select
                className="mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {['registered', 'approved', 'in_auction', 'sold', 'unsold', 'reauction'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-teal-300">
              Player photo
              <div className="mt-1 flex items-center gap-2">
                {form.photo_url && (
                  <img src={form.photo_url} alt="" className="h-10 w-10 rounded object-cover border border-teal-700/40" />
                )}
                <input type="file" accept="image/*" className="text-xs"
                  disabled={uploadingPhoto}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f) }} />
              </div>
              {uploadingPhoto && <p className="text-teal-400 text-xs mt-1 animate-pulse">Uploading photo…</p>}
            </label>

            {err && <p className="text-red-400 text-xs">{err}</p>}

            <div className="flex gap-2">
              <button onClick={save} disabled={!form.name || saving || uploadingPhoto}
                className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50">
                {saving ? 'Saving…' : 'Save player'}
              </button>
              {editId && (
                <button onClick={() => { setEditId(null); setForm(blankFor(auction)); setErr('') }}
                  className="text-xs text-teal-300">Cancel</button>
              )}
            </div>
          </div>

          {/* ---- Player list ---- */}
          <div className="lg:col-span-2 rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">

            {/* CSV toolbar */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={() => download('players-template.csv', playersCsvTemplate())}
                className="px-3 py-1 rounded bg-teal-700/50 text-sm">Download template</button>
              <button onClick={() => download('players-export.csv', exportPlayersCsv(players))}
                className="px-3 py-1 rounded bg-teal-700/50 text-sm">Export CSV</button>
              <label className="px-3 py-1 rounded bg-gold/80 text-ink-900 font-semibold text-sm cursor-pointer">
                Bulk import CSV
                <input type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
              </label>
            </div>

            {report && (
              <div className="mb-3 rounded-lg border border-teal-600/40 bg-teal-900/20 p-3 text-sm">
                <p className="text-teal-200">Imported <b>{report.inserted}</b> of {report.total} rows. Skipped {report.skipped}.</p>
                {report.failures.length > 0 && (
                  <ul className="mt-1 text-red-400 text-xs list-disc pl-4 max-h-28 overflow-y-auto">
                    {report.failures.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Bulk actions */}
            {players.length > 0 && (
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-teal-300 cursor-pointer">
                  <input type="checkbox"
                    checked={selected.size === players.length && players.length > 0}
                    onChange={selectAll} />
                  {selected.size === 0 ? 'Select all' : `${selected.size} selected`}
                </label>
                {selected.size > 0 && (
                  <>
                    <button onClick={() => bulkSetStatus('approved')} disabled={bulkBusy}
                      className="px-2 py-1 text-xs rounded bg-teal-600/70 disabled:opacity-50">
                      {bulkBusy ? '…' : 'Approve selected'}
                    </button>
                    <button onClick={() => bulkSetStatus('registered')} disabled={bulkBusy}
                      className="px-2 py-1 text-xs rounded bg-ink-900 border border-teal-700/50 disabled:opacity-50">
                      {bulkBusy ? '…' : 'Unapprove selected'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {players.map((p) => (
                <div key={p.id}
                  className={`border rounded-lg p-3 flex justify-between items-center gap-3 ${selected.has(p.id) ? 'border-teal-500/60 bg-teal-900/20' : 'border-teal-700/40'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)} className="shrink-0" />
                    <div className="h-9 w-9 rounded-lg bg-ink-900 border border-teal-700/40 overflow-hidden grid place-items-center shrink-0">
                      {p.photo_url
                        ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                        : <span className="text-[0.55rem] text-teal-500">no img</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white truncate">
                        {p.name}
                        <span className="text-teal-500 text-xs"> · {p.role}{p.category ? ` / ${p.category}` : ''}</span>
                      </p>
                      <p className="text-xs text-teal-300">
                        Base {p.base_price} ·{' '}
                        <span className={p.status === 'sold' ? 'text-gold' : p.status === 'approved' ? 'text-teal-400' : ''}>{p.status}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => toggleApprove(p)}
                      className={`px-2 py-1 text-xs rounded ${p.status === 'approved' ? 'bg-teal-600/50' : 'bg-ink-900 border border-teal-700/50'}`}>
                      {p.status === 'approved' ? 'Unapprove' : 'Approve'}
                    </button>
                    <button onClick={() => { setEditId(p.id); setForm({ ...blankFor(auction), ...p }); setErr('') }}
                      className="px-2 py-1 text-xs rounded bg-teal-700/50">Edit</button>
                    <button onClick={async () => { await deletePlayer(p.id); reload() }}
                      className="px-2 py-1 text-xs rounded bg-red-900/50">Delete</button>
                  </div>
                </div>
              ))}
              {players.length === 0 && <p className="text-teal-500 text-sm">No players yet — add one or bulk import.</p>}
            </div>
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}
