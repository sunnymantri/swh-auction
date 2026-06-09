import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import PlayerCard from '../components/auction/PlayerCard'
import { useActiveAuction } from '../hooks/useActiveAuction'
import {
  createPlayer, deletePlayer, exportPlayersCsv, listPlayers,
  parsePlayersCsvDetailed, playersCsvTemplate, updatePlayer, uploadPlayerPhoto,
  createCategory, deleteCategory, listCategories, updateCategory,
  fetchCricHeroesStats
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { calcBattingPoints, calcBowlingPoints, calcFieldingPoints, calcTotalPoints, calcPPM, getTier, buildTierIndexByPlayerId, computeCohortBasePrices } from '../lib/points'

const TABS = ['Players', 'Add Player', 'Categories']

// Human-readable labels for every player status value
const STATUS_LABELS = {
  not_registered:    'Not registered',
  registered:        'Registered',
  ready_for_auction: 'Ready for auction',
  in_auction:        'In auction',
  sold:              'Sold',
  unsold:            'Unsold',
  reauction:         'Re-auction',
}

const blankFor = (auction) => ({
  name: '', role: '', category: '', base_price: auction?.default_base_price ?? 500,
  status: 'registered',
  batting_style: '', bowling_style: '', profile_url: '',
  matches: 0, runs: 0, bat_avg: 0, wickets: 0, catches: 0,
  strike_rate: 0, bowl_avg: 0, economy: 0, photo_url: '',
  fifties: 0, hundreds: 0, sixes: 0,
  dot_balls: 0, three_wicket_hauls: 0, five_wicket_hauls: 0,
  run_outs: 0, stumpings: 0
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
  { key: 'fifties',       label: '50s',                     type: 'number' },
  { key: 'hundreds',      label: '100s',                    type: 'number' },
  { key: 'sixes',         label: 'Sixes',                   type: 'number' },
  { key: 'wickets',       label: 'Wickets',                 type: 'number' },
  { key: 'bowl_avg',      label: 'Bowling average',         type: 'number' },
  { key: 'economy',       label: 'Economy',                 type: 'number' },
  { key: 'dot_balls',     label: 'Dot balls',              type: 'number' },
  { key: 'three_wicket_hauls', label: '3-wicket hauls',    type: 'number' },
  { key: 'five_wicket_hauls',  label: '5-wicket hauls',    type: 'number' },
  { key: 'catches',       label: 'Catches',                 type: 'number' },
  { key: 'run_outs',      label: 'Run outs',               type: 'number' },
  { key: 'stumpings',     label: 'Stumpings',              type: 'number' },
]

const blankCat = { name: '', sequence_order: 1, minimum_required: 0, maximum_allowed: 0 }
const CAT_FIELD_LABELS = {
  sequence_order: 'Sequence order',
  minimum_required: 'Minimum required',
  maximum_allowed: 'Maximum allowed'
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const extractCricHeroesProfileId = (url = '') => {
  const match = String(url).match(/player-profile\/(\d+)/i)
  return match?.[1] || null
}

const mergeFetchedStats = (player, stats) => ({
  ...player,
  name: stats.name || player.name,
  matches: stats.matches ?? player.matches,
  runs: stats.runs ?? player.runs,
  wickets: stats.wickets ?? player.wickets,
  bat_avg: stats.bat_avg ?? player.bat_avg,
  strike_rate: stats.strike_rate ?? player.strike_rate,
  economy: stats.economy ?? player.economy,
  catches: stats.catches ?? player.catches,
  batting_style: stats.batting_style || player.batting_style,
  bowling_style: stats.bowling_style || player.bowling_style,
  role: stats.role || player.role,
  photo_url: stats.photo_url || player.photo_url,
})

const buildStatsUpdatePayload = (player) => ({
  name: player.name,
  matches: player.matches,
  runs: player.runs,
  wickets: player.wickets,
  bat_avg: player.bat_avg,
  strike_rate: player.strike_rate,
  economy: player.economy,
  catches: player.catches,
  batting_style: player.batting_style,
  bowling_style: player.bowling_style,
  role: player.role,
  photo_url: player.photo_url
  // base_price is set cohort-relative via recalculation, not here.
})

export default function PlayersManagement() {
  const { auction } = useActiveAuction()
  const [tab, setTab] = useState('Players')

  // Player state
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState(blankFor(null))
  const [editId, setEditId] = useState(null)
  const [report, setReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [fetchingStats, setFetchingStats] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  // Filter state
  const [statusFilter, setStatusFilter] = useState(null)
  // Player profile view
  const [viewPlayer, setViewPlayer] = useState(null)
  const [recalculating, setRecalculating] = useState(false)
  const [syncingProfileStats, setSyncingProfileStats] = useState(false)
  const [bulkSyncReport, setBulkSyncReport] = useState(null)

  // Category state
  const [categories, setCategories] = useState([])
  const [catForm, setCatForm] = useState(blankCat)
  const [catEditId, setCatEditId] = useState(null)

  const reloadPlayers = async () => {
    if (!auction) return
    setPlayers(await listPlayers(auction.id))
  }
  const reloadCategories = async () => {
    if (!auction) return
    setCategories(await listCategories(auction.id))
  }
  useEffect(() => { reloadPlayers(); reloadCategories() }, [auction])
  useEffect(() => { if (!editId) setForm(blankFor(auction)) }, [auction, editId])

  // Status counts and filtered list
  const statusCounts = useMemo(() => {
    const counts = {}
    for (const p of players) {
      counts[p.status] = (counts[p.status] || 0) + 1
    }
    return counts
  }, [players])

  const filteredPlayers = useMemo(() => {
    if (!statusFilter) return players
    return players.filter((p) => p.status === statusFilter)
  }, [players, statusFilter])

  const tierByPlayerId = useMemo(() => buildTierIndexByPlayerId(players), [players])

  const formTier = useMemo(() => {
    const tempId = editId || '__form_preview__'
    const pool = [...players.filter((p) => p.id !== editId), { ...form, id: tempId }]
    const byId = buildTierIndexByPlayerId(pool)
    return byId[tempId] || getTier(calcPPM(form))
  }, [players, form, editId])

  // Duplicate detection: find players with matching name+phone or name+email
  const findDuplicates = (name, email, phone) => {
    const normName = name?.trim().toLowerCase()
    if (!normName) return []
    return players.filter((p) => {
      if (editId && p.id === editId) return false
      const pName = p.name?.trim().toLowerCase()
      if (pName !== normName) return false
      if (email && p.email && p.email.toLowerCase() === email.toLowerCase()) return true
      if (phone && p.phone && p.phone === phone) return true
      // Same name alone is a potential duplicate
      return true
    })
  }

  const duplicates = useMemo(
    () => findDuplicates(form.name, form.email, form.phone),
    [form.name, form.email, form.phone, players, editId]
  )

  const getCalculatedPoints = (player) => {
    return Math.round(calcTotalPoints(player))
  }

  // Base price is cohort-relative: a player's price depends on the whole
  // pool. So every recalc re-prices the entire cohort and persists the
  // rows whose base price or performance points actually changed.
  const persistBasePrices = async (list) => {
    const priceById = computeCohortBasePrices(list)
    const updates = []
    for (const p of list) {
      const newBase = priceById[p.id]
      if (newBase == null) continue
      const newCalc = getCalculatedPoints(p)
      if (newBase !== p.base_price || newCalc !== p.calculated_value) {
        updates.push(updatePlayer(p.id, { base_price: newBase, calculated_value: newCalc }))
      }
    }
    await Promise.all(updates)
    return priceById
  }

  // Toolbar action — re-price everyone (Option A: only on explicit click).
  const recalcAllBasePrices = async () => {
    if (recalculating || players.length === 0) return
    setErr('')
    setRecalculating(true)
    try {
      await persistBasePrices(players)
      await reloadPlayers()
    } catch (e) {
      setErr(e?.message || 'Recalculate failed. Please try again.')
    } finally {
      setRecalculating(false)
    }
  }

  // Per-player Recalculate button: still re-prices the whole cohort
  // (prices are relative), then refreshes the player being viewed.
  const recalculatePlayer = async (player) => {
    if (!player?.id || recalculating) return
    setErr('')
    setRecalculating(true)
    try {
      const priceById = await persistBasePrices(players)
      await reloadPlayers()
      setViewPlayer({
        ...player,
        calculated_value: getCalculatedPoints(player),
        base_price: priceById[player.id] ?? player.base_price
      })
    } catch (e) {
      setErr(e?.message || 'Recalculate failed. Please try again.')
    } finally {
      setRecalculating(false)
    }
  }

  const fetchAndRecalculateProfilePlayer = async (player) => {
    if (!player?.id || syncingProfileStats) return
    if (!extractCricHeroesProfileId(player.profile_url)) {
      setErr('Valid CricHeroes profile URL required to fetch stats.')
      return
    }

    setErr('')
    setSyncingProfileStats(true)
    try {
      const stats = await fetchCricHeroesStats(player.profile_url)
      const mergedPlayer = mergeFetchedStats(player, stats)
      const calculatedPoints = getCalculatedPoints(mergedPlayer)

      await updatePlayer(player.id, {
        ...buildStatsUpdatePayload(mergedPlayer),
        calculated_value: calculatedPoints
      })

      // Re-price the whole cohort with this player's fresh stats applied.
      const updatedList = players.map((p) => (
        p.id === player.id ? { ...mergedPlayer, calculated_value: calculatedPoints } : p
      ))
      const priceById = await persistBasePrices(updatedList)

      await reloadPlayers()
      setViewPlayer({
        ...mergedPlayer,
        calculated_value: calculatedPoints,
        base_price: priceById[player.id] ?? mergedPlayer.base_price
      })
    } catch (e) {
      setErr(`Fetch/Recalculate failed: ${e.message}`)
    } finally {
      setSyncingProfileStats(false)
    }
  }

  if (!auction) {
    return (
      <AppShell title="Players">
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
      // Base price is set via "Recalculate base prices" (cohort-relative),
      // not on save — keep whatever the admin entered here.
      const payload = { ...form, auction_id: auction.id }
      if (editId) await updatePlayer(editId, payload)
      else await createPlayer(payload)
      setEditId(null)
      setForm(blankFor(auction))
      await reloadPlayers()
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

  const fetchFromCricHeroes = async () => {
    if (!form.profile_url) { setErr('Enter a CricHeroes profile URL first.'); return }
    setErr(''); setFetchingStats(true)
    try {
      const stats = await fetchCricHeroesStats(form.profile_url)
      setForm((s) => mergeFetchedStats(s, stats))
    } catch (e) {
      setErr(`CricHeroes fetch failed: ${e.message}`)
    } finally {
      setFetchingStats(false)
    }
  }

  const toggleApprove = async (p) => {
    const next = p.status === 'ready_for_auction' ? 'registered' : 'ready_for_auction'
    await updatePlayer(p.id, { status: next })
    await reloadPlayers()
  }

  const toggleSelect = (id) => setSelected((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const selectAll = () => setSelected(
    selected.size === filteredPlayers.length ? new Set() : new Set(filteredPlayers.map((p) => p.id))
  )

  const bulkSetStatus = async (status) => {
    setBulkBusy(true)
    try {
      await Promise.all([...selected].map((id) => updatePlayer(id, { status })))
      setSelected(new Set())
      await reloadPlayers()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkFetchAndRecalculateSelected = async () => {
    if (selected.size === 0) return

    setErr('')
    setBulkBusy(true)
    setBulkSyncReport(null)

    let workingPlayers = [...players]
    const summary = { success: 0, skipped: [], failed: [] }

    try {
      for (const id of selected) {
        const player = workingPlayers.find((p) => p.id === id)
        if (!player) {
          summary.skipped.push(`Unknown player (${id})`)
          continue
        }
        if (!extractCricHeroesProfileId(player.profile_url)) {
          summary.skipped.push(`${player.name}: missing/invalid CricHeroes URL`)
          continue
        }

        try {
          const stats = await fetchCricHeroesStats(player.profile_url)
          const mergedPlayer = mergeFetchedStats(player, stats)
          const calculatedPoints = getCalculatedPoints(mergedPlayer)

          await updatePlayer(player.id, {
            ...buildStatsUpdatePayload(mergedPlayer),
            calculated_value: calculatedPoints
          })

          workingPlayers = workingPlayers.map((p) => (
            p.id === player.id
              ? { ...mergedPlayer, calculated_value: calculatedPoints }
              : p
          ))
          summary.success += 1
        } catch (e) {
          summary.failed.push(`${player.name}: ${e.message}`)
        }
      }

      // Re-price the cohort once, after all fetched stats are applied.
      await persistBasePrices(workingPlayers)

      await reloadPlayers()
      setSelected(new Set())
      setBulkSyncReport(summary)
    } catch (e) {
      setErr(e.message || 'Bulk fetch/recalculate failed.')
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
    // Imported rows keep their own base price (or the auction default).
    // Cohort-relative prices are applied later via "Recalculate base prices".
    const defaultBase = auction?.default_base_price ?? 500
    try {
      const payload = rows.map(r => ({ ...r, base_price: r.base_price ?? defaultBase, auction_id: auction.id }))
      const { data, error } = await supabase
        .from('players')
        .insert(payload)
        .select('id')
      if (error) {
        for (const row of rows) {
          try {
            await createPlayer({ ...row, base_price: row.base_price ?? defaultBase, auction_id: auction.id })
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
    await reloadPlayers()
  }

  // Category handlers
  const saveCat = async () => {
    const payload = { ...catForm, auction_id: auction.id, maximum_allowed: catForm.maximum_allowed || null }
    if (catEditId) await updateCategory(catEditId, payload)
    else await createCategory(payload)
    setCatForm(blankCat)
    setCatEditId(null)
    await reloadCategories()
  }

  return (
    <AppShell title="Players">
      <RoleGate allow={['admin']}>
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-teal-700/40 pb-px mb-5 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${tab === t ? 'bg-ink-800/60 text-gold border border-teal-700/40 border-b-transparent -mb-px' : 'text-teal-300 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Player profile overlay */}
        {viewPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setViewPlayer(null)}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <PlayerCard
                player={viewPlayer}
                showPoints
                onRecalculate={() => recalculatePlayer(viewPlayer)}
                recalculating={recalculating}
                onFetchAndRecalculate={() => fetchAndRecalculateProfilePlayer(viewPlayer)}
                fetchingAndRecalculating={syncingProfileStats}
                tierOverride={viewPlayer ? (tierByPlayerId[viewPlayer.id] || getTier(calcPPM(viewPlayer))) : null}
              />
              <button onClick={() => setViewPlayer(null)}
                className="mt-3 w-full py-2 text-sm text-teal-300 hover:text-white bg-ink-800/80 border border-teal-700/40 rounded-xl">
                Close
              </button>
            </div>
          </div>
        )}

        {(tab === 'Players' || tab === 'Add Player') && (
          <div className="grid gap-4 xl:grid-cols-3">
            {/* Create / Edit form */}
            <div className={`${tab === 'Add Player' ? '' : 'hidden'} rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 flex flex-col gap-3`}>
              <h3 className="font-score text-lg text-teal-200 shrink-0">{editId ? 'Edit player' : 'Create player'}</h3>

              {/* Scrollable field area */}
              <div className="overflow-y-auto max-h-[70vh] pr-1 space-y-4">

                {/* CricHeroes fetch — full width */}
                <div>
                  <p className="text-xs text-teal-300 mb-1">Profile URL (CricHeroes)</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.profile_url ?? ''}
                      onChange={(e) => set('profile_url', e.target.value)}
                      placeholder="https://cricheroes.com/player-profile/..."
                      className="flex-1 min-w-0 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-1.5 text-white text-sm"
                    />
                    <button type="button" onClick={fetchFromCricHeroes} disabled={fetchingStats || !form.profile_url}
                      className="px-3 py-1.5 rounded-lg bg-teal-600/70 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-40">
                      {fetchingStats ? 'Fetching…' : 'Fetch stats'}
                    </button>
                  </div>
                </div>

                {/* Identity — 2 columns */}
                <fieldset className="border border-teal-700/30 rounded-lg p-3 space-y-2">
                  <legend className="text-[0.65rem] text-teal-400 uppercase tracking-wider px-1">Identity</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'name', label: 'Full name', type: 'text', span: true },
                      { key: 'role', label: 'Role', type: 'text' },
                      { key: 'category', label: 'Category', type: 'text' },
                      { key: 'batting_style', label: 'Batting style', type: 'text' },
                      { key: 'bowling_style', label: 'Bowling style', type: 'text' },
                      { key: 'base_price', label: 'Base price', type: 'number' },
                    ].map(({ key, label, type, span }) => (
                      <label key={key} className={`block text-xs text-teal-300 ${span ? 'col-span-2' : ''}`}>
                        {label}
                        <input
                          type="text"
                          inputMode={type === 'number' ? 'numeric' : 'text'}
                          value={form[key] ?? ''}
                          onChange={(e) => set(key, type === 'number'
                            ? Number(e.target.value.replace(/[^\d.]/g, '') || 0)
                            : e.target.value)}
                          className="mt-0.5 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2.5 py-1.5 text-white text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs text-teal-300">
                      Status
                      <select className="mt-0.5 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2.5 py-1.5 text-white text-sm"
                        value={form.status} onChange={(e) => set('status', e.target.value)}>
                        {['not_registered', 'registered', 'ready_for_auction', 'in_auction', 'sold', 'unsold', 'reauction'].map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-teal-300">
                      Player photo
                      <div className="mt-0.5 flex items-center gap-2">
                        {form.photo_url && (
                          <img src={form.photo_url} alt="" className="h-8 w-8 rounded object-cover border border-teal-700/40 shrink-0" />
                        )}
                        <input type="file" accept="image/*" className="text-xs min-w-0"
                          disabled={uploadingPhoto}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f) }} />
                      </div>
                      {uploadingPhoto && <p className="text-teal-400 text-xs mt-0.5 animate-pulse">Uploading…</p>}
                    </label>
                  </div>
                </fieldset>

                {/* Batting stats — 2 columns */}
                <fieldset className="border border-teal-700/30 rounded-lg p-3 space-y-2">
                  <legend className="text-[0.65rem] text-teal-400 uppercase tracking-wider px-1">Batting</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'matches', label: 'Matches' },
                      { key: 'runs', label: 'Runs' },
                      { key: 'bat_avg', label: 'Average' },
                      { key: 'strike_rate', label: 'Strike rate' },
                      { key: 'fifties', label: '50s' },
                      { key: 'hundreds', label: '100s' },
                      { key: 'sixes', label: 'Sixes' },
                    ].map(({ key, label }) => (
                      <label key={key} className="block text-xs text-teal-300">
                        {label}
                        <input type="text" inputMode="numeric"
                          value={form[key] ?? ''}
                          onChange={(e) => set(key, Number(e.target.value.replace(/[^\d.]/g, '') || 0))}
                          className="mt-0.5 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2.5 py-1.5 text-white text-sm" />
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Bowling stats — 2 columns */}
                <fieldset className="border border-teal-700/30 rounded-lg p-3 space-y-2">
                  <legend className="text-[0.65rem] text-teal-400 uppercase tracking-wider px-1">Bowling</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'wickets', label: 'Wickets' },
                      { key: 'bowl_avg', label: 'Average' },
                      { key: 'economy', label: 'Economy' },
                      { key: 'dot_balls', label: 'Dot balls' },
                      { key: 'three_wicket_hauls', label: '3-wkt hauls' },
                      { key: 'five_wicket_hauls', label: '5-wkt hauls' },
                    ].map(({ key, label }) => (
                      <label key={key} className="block text-xs text-teal-300">
                        {label}
                        <input type="text" inputMode="numeric"
                          value={form[key] ?? ''}
                          onChange={(e) => set(key, Number(e.target.value.replace(/[^\d.]/g, '') || 0))}
                          className="mt-0.5 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2.5 py-1.5 text-white text-sm" />
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Fielding stats — 2 columns */}
                <fieldset className="border border-teal-700/30 rounded-lg p-3 space-y-2">
                  <legend className="text-[0.65rem] text-teal-400 uppercase tracking-wider px-1">Fielding</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'catches', label: 'Catches' },
                      { key: 'run_outs', label: 'Run outs' },
                      { key: 'stumpings', label: 'Stumpings' },
                    ].map(({ key, label }) => (
                      <label key={key} className="block text-xs text-teal-300">
                        {label}
                        <input type="text" inputMode="numeric"
                          value={form[key] ?? ''}
                          onChange={(e) => set(key, Number(e.target.value.replace(/[^\d.]/g, '') || 0))}
                          className="mt-0.5 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2.5 py-1.5 text-white text-sm" />
                      </label>
                    ))}
                  </div>
                </fieldset>

              </div>{/* end scrollable area */}

              {/* Auto-calculated points preview */}
              {form.matches > 0 && (
                <div className="rounded-lg border border-teal-700/40 bg-ink-900/50 p-3 shrink-0">
                  <p className="text-xs font-semibold text-teal-200 uppercase tracking-wide mb-1">Calculated Points (PPM)</p>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                    <span className="text-teal-400">Batting:</span><span className="text-white col-span-2">{calcBattingPoints(form).toFixed(1)}</span>
                    <span className="text-teal-400">Bowling:</span><span className="text-white col-span-2">{calcBowlingPoints(form).toFixed(1)}</span>
                    <span className="text-teal-400">Fielding:</span><span className="text-white col-span-2">{calcFieldingPoints(form).toFixed(1)}</span>
                    <span className="text-teal-400 font-semibold">Total:</span><span className="text-white font-semibold col-span-2">{calcTotalPoints(form).toFixed(1)}</span>
                    <span className="text-teal-400 font-semibold">PPM:</span>
                    <span className={`font-semibold col-span-2 ${formTier.color}`}>
                      {calcPPM(form).toFixed(2)} ({formTier.label})
                    </span>
                  </div>
                </div>
              )}

              {/* Duplicate warning */}
              {duplicates.length > 0 && (
                <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 p-2">
                  <p className="text-yellow-400 text-xs font-semibold">Possible duplicate{duplicates.length > 1 ? 's' : ''} found:</p>
                  <ul className="text-xs text-yellow-300 mt-1 space-y-0.5">
                    {duplicates.map((d) => (
                      <li key={d.id}>{d.name} — {d.role} ({d.status})</li>
                    ))}
                  </ul>
                </div>
              )}

              {err && <p className="text-red-400 text-xs">{err}</p>}
              <div className="flex flex-wrap gap-2">
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

            {/* Player list */}
            <div className={`${tab === 'Players' ? 'xl:col-span-3' : 'hidden'} rounded-xl border border-teal-700/40 bg-ink-800/60 p-4`}>
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
                <button
                  onClick={recalcAllBasePrices}
                  disabled={recalculating || players.length === 0}
                  title="Re-price every player relative to the full cohort (percentile → ₹500–₹10,000)"
                  className="px-3 py-1 rounded bg-teal-600/70 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {recalculating ? 'Recalculating…' : 'Recalculate base prices'}
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={bulkFetchAndRecalculateSelected}
                    disabled={bulkBusy}
                    className="px-3 py-1 rounded bg-gold text-ink-900 font-semibold text-sm disabled:opacity-50"
                  >
                    {bulkBusy ? 'Processing…' : 'Fetch + Recalculate selected'}
                  </button>
                )}
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
              {bulkSyncReport && (
                <div className="mb-3 rounded-lg border border-teal-600/40 bg-teal-900/20 p-3 text-sm">
                  <p className="text-teal-200">
                    Bulk fetch/recalculate completed. Success: <b>{bulkSyncReport.success}</b> ·
                    Skipped: <b>{bulkSyncReport.skipped.length}</b> ·
                    Failed: <b>{bulkSyncReport.failed.length}</b>
                  </p>
                  {[...bulkSyncReport.skipped, ...bulkSyncReport.failed].length > 0 && (
                    <ul className="mt-1 text-red-400 text-xs list-disc pl-4 max-h-28 overflow-y-auto">
                      {[...bulkSyncReport.skipped, ...bulkSyncReport.failed].map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Status filter tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => setStatusFilter(null)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition ${!statusFilter ? 'bg-teal-600 text-white' : 'bg-ink-900 border border-teal-700/50 text-teal-300 hover:text-white'}`}>
                  All ({players.length})
                </button>
                {['not_registered', 'registered', 'ready_for_auction', 'in_auction', 'sold', 'unsold'].map((s) => {
                  const count = statusCounts[s] || 0
                  if (count === 0 && s !== 'ready_for_auction' && s !== 'registered') return null
                  const colors = {
                    not_registered: 'bg-gray-800/60 border-gray-600/50 text-gray-400',
                    registered: 'bg-blue-900/40 border-blue-600/50 text-blue-400',
                    ready_for_auction: 'bg-green-900/40 border-green-600/50 text-green-400',
                    in_auction: 'bg-yellow-900/40 border-yellow-600/50 text-yellow-400',
                    sold: 'bg-gold/20 border-gold/50 text-gold',
                    unsold: 'bg-red-900/40 border-red-600/50 text-red-400',
                  }
                  return (
                    <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                      className={`px-2.5 py-1 text-xs rounded-full font-medium border transition ${statusFilter === s ? colors[s] : 'bg-ink-900 border-teal-700/50 text-teal-300 hover:text-white'}`}>
                      {STATUS_LABELS[s]} ({count})
                    </button>
                  )
                })}
              </div>

              {filteredPlayers.length > 0 && (
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-teal-300 cursor-pointer">
                    <input type="checkbox"
                      checked={selected.size === filteredPlayers.length && filteredPlayers.length > 0}
                      onChange={selectAll} />
                    {selected.size === 0 ? 'Select all' : `${selected.size} selected`}
                  </label>
                  {selected.size > 0 && (
                    <>
                      <button onClick={() => bulkSetStatus('ready_for_auction')} disabled={bulkBusy}
                        className="px-2 py-1 text-xs rounded bg-green-700/60 text-white disabled:opacity-50">
                        {bulkBusy ? '…' : '✓ Ready for auction'}
                      </button>
                      <button onClick={() => bulkSetStatus('registered')} disabled={bulkBusy}
                        className="px-2 py-1 text-xs rounded bg-ink-900 border border-teal-700/50 disabled:opacity-50">
                        {bulkBusy ? '…' : 'Move to registered'}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {filteredPlayers.map((p) => {
                  const ppm = calcPPM(p)
                  const tier = tierByPlayerId[p.id] || getTier(ppm)
                  return (
                    <div key={p.id}
                      className={`border rounded-lg p-3 flex flex-col gap-2 ${selected.has(p.id) ? 'border-teal-500/60 bg-teal-900/20' : 'border-teal-700/40'}`}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
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
                              <button onClick={() => setViewPlayer(p)} className="hover:text-gold transition text-left">
                                {p.name}
                              </button>
                              <span className="text-teal-500 text-xs"> · {p.role}{p.category ? ` / ${p.category}` : ''}</span>
                            </p>
                            <p className="text-xs text-teal-300">
                              Base {p.base_price} ·{' '}
                              <span className={
                                p.status === 'sold' ? 'text-gold' :
                                p.status === 'ready_for_auction' ? 'text-green-400' :
                                p.status === 'in_auction' ? 'text-yellow-400' :
                                p.status === 'not_registered' ? 'text-gray-400' : ''
                              }>{STATUS_LABELS[p.status] ?? p.status}</span>
                              {p.weeks_away > 0 && (
                                <span className="text-yellow-400 ml-1">· Away {p.weeks_away}w</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button onClick={() => toggleApprove(p)}
                            className={`px-2 py-1 text-xs rounded ${p.status === 'ready_for_auction' ? 'bg-green-700/50 text-white' : 'bg-ink-900 border border-teal-700/50 text-teal-300'}`}>
                            {p.status === 'ready_for_auction' ? '✓ Ready — Remove' : 'Set Ready for Auction'}
                          </button>
                          <button onClick={() => { setEditId(p.id); setForm({ ...blankFor(auction), ...p }); setErr(''); setTab('Add Player') }}
                            className="px-2 py-1 text-xs rounded bg-teal-700/50">Edit</button>
                          <button onClick={async () => { await deletePlayer(p.id); reloadPlayers() }}
                            className="px-2 py-1 text-xs rounded bg-red-900/50">Delete</button>
                        </div>
                      </div>
                      {/* Points breakdown row */}
                      {p.matches > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-[0.7rem] text-teal-400 sm:ml-[3.25rem]">
                          <span>Bat: <b className="text-white">{calcBattingPoints(p).toFixed(0)}</b></span>
                          <span>Bowl: <b className="text-white">{calcBowlingPoints(p).toFixed(0)}</b></span>
                          <span>Field: <b className="text-white">{calcFieldingPoints(p).toFixed(0)}</b></span>
                          <span>Total: <b className="text-white">{calcTotalPoints(p).toFixed(0)}</b></span>
                          <span>PPM: <b className={tier.color}>{ppm.toFixed(1)}</b></span>
                          <span className={`font-semibold ${tier.color}`}>{tier.label}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
                {filteredPlayers.length === 0 && <p className="text-teal-500 text-sm">{players.length === 0 ? 'No players yet — add one or bulk import.' : 'No players match this filter.'}</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'Categories' && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Description card */}
            <div className="md:col-span-3 rounded-xl border border-teal-600/30 bg-teal-900/20 p-4">
              <p className="text-sm font-semibold text-teal-200 mb-1">📂 What are Categories?</p>
              <p className="text-xs text-teal-300 leading-relaxed">
                Categories group players by role (e.g. <span className="text-white">Wicketkeeper</span>, <span className="text-white">Batter</span>, <span className="text-white">Bowler</span>) so each team must pick the right mix.
                Set a <span className="text-white">Minimum required</span> to enforce squad balance — every team must buy at least that many from this group.
                Set a <span className="text-white">Maximum allowed</span> to cap how many a team can buy (leave 0 for no cap).
                The <span className="text-white">Sequence order</span> controls the order in which categories go to auction — lower number goes first.
              </p>
            </div>
            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
              <label className="block text-xs text-teal-300 uppercase tracking-wide">
                Category name
                <input placeholder="e.g. Wicketkeeper" value={catForm.name}
                  onChange={(e) => setCatForm((s) => ({ ...s, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              </label>
              {['sequence_order', 'minimum_required', 'maximum_allowed'].map((f) => (
                <label key={f} className="block text-xs text-teal-300 uppercase tracking-wide">
                  {CAT_FIELD_LABELS[f]}
                  <input placeholder={CAT_FIELD_LABELS[f]} value={catForm[f]}
                    onChange={(e) => setCatForm((s) => ({ ...s, [f]: Number(e.target.value || 0) }))}
                    className="mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
                </label>
              ))}
              <button onClick={saveCat} className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold">Save</button>
            </div>
            <div className="md:col-span-2 rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="border border-teal-700/40 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between gap-2">
                  <div>
                    <p>{c.sequence_order}. {c.name}</p>
                    <p className="text-xs text-teal-300">Min {c.minimum_required} · Max {c.maximum_allowed ?? '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setCatEditId(c.id); setCatForm(c) }} className="px-2 py-1 text-xs rounded bg-teal-700/50">Edit</button>
                    <button onClick={async () => { await deleteCategory(c.id); reloadCategories() }} className="px-2 py-1 text-xs rounded bg-live/40">Delete</button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="text-teal-500 text-sm">No categories yet.</p>}
            </div>
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
