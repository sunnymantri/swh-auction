import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import PlayerCard from '../components/auction/PlayerCard'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuth } from '../context/AuthContext'
import {
  createPlayer, deletePlayer, exportPlayersCsv, listPlayers,
  parsePlayersCsvDetailed, playersCsvTemplate, updatePlayer, uploadPlayerPhoto,
  updatePlayerVacation,
  createCategory, deleteCategory, listCategories, updateCategory,
  fetchCricHeroesStats, fetchPlayHQStats
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { calcBattingPoints, calcBowlingPoints, calcFieldingPoints, calcTotalPoints, calcPPM, getTier, buildTierIndexByPlayerId, computeCohortBasePrices } from '../lib/points'

const TABS = ['Players', 'Add Player', 'Categories', 'Vacation']

// Human-readable labels for every player status value
const STATUS_LABELS = {
  not_registered:    'Not registered',
  registered:        'Registered',
  ready_for_auction: 'Ready for auction',
  in_auction:        'In auction',
  sold:              'Sold',
  unsold:            'Unsold',
  reauction:         'Re-auction',
  retired:           'Retired',
}

const blankFor = (auction) => ({
  name: '', role: '', category: '', base_price: auction?.default_base_price ?? 500,
  status: 'registered',
  batting_style: '', bowling_style: '', profile_url: '', playhq_url: '',
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
  // Extended fields returned by Play Cricket/PlayHQ fetch (no-op for CricHeroes)
  ...(stats.fifties != null && { fifties: stats.fifties }),
  ...(stats.hundreds != null && { hundreds: stats.hundreds }),
  ...(stats.sixes != null && { sixes: stats.sixes }),
  ...(stats.bowl_avg != null && { bowl_avg: stats.bowl_avg }),
  ...(stats.dot_balls != null && { dot_balls: stats.dot_balls }),
  ...(stats.three_wicket_hauls != null && { three_wicket_hauls: stats.three_wicket_hauls }),
  ...(stats.five_wicket_hauls != null && { five_wicket_hauls: stats.five_wicket_hauls }),
  ...(stats.run_outs != null && { run_outs: stats.run_outs }),
  ...(stats.stumpings != null && { stumpings: stats.stumpings }),
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
  run_outs: player.run_outs,
  stumpings: player.stumpings,
  fifties: player.fifties,
  hundreds: player.hundreds,
  sixes: player.sixes,
  bowl_avg: player.bowl_avg,
  dot_balls: player.dot_balls,
  three_wicket_hauls: player.three_wicket_hauls,
  five_wicket_hauls: player.five_wicket_hauls,
  batting_style: player.batting_style,
  bowling_style: player.bowling_style,
  role: player.role,
  photo_url: player.photo_url
  // base_price is set cohort-relative via recalculation, not here.
})

export default function PlayersManagement() {
  const { role } = useAuth()
  const { auction } = useActiveAuction()
  const location = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab')
    return TABS.includes(t) ? t : 'Players'
  })

  // Player state
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState(blankFor(null))
  const [editId, setEditId] = useState(null)
  const [report, setReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [fetchingStats, setFetchingStats] = useState(false)
  const [fetchingPlayHQ, setFetchingPlayHQ] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [addStep, setAddStep] = useState(1)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('ready_for_auction')
  const [search, setSearch] = useState('')
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
  useEffect(() => { setAddStep(1) }, [editId])
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t && TABS.includes(t)) setTab(t)
  }, [location.search])

  // Status counts and filtered list
  const statusCounts = useMemo(() => {
    const counts = {}
    for (const p of players) {
      counts[p.status] = (counts[p.status] || 0) + 1
    }
    return counts
  }, [players])

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return players
      .filter((p) => !statusFilter || p.status === statusFilter)
      .filter((p) => !term || p.name.toLowerCase().includes(term))
  }, [players, statusFilter, search])

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

  const set = (k, v) => {
    setSuccessMsg('')
    setForm((s) => ({ ...s, [k]: v }))
  }

  // Recalculate points from within the Edit form: persist the current stats,
  // refresh the player's calculated_value, then re-price the whole cohort
  // (base prices are relative). Stays in edit mode on the same player.
  const recalculateForm = async () => {
    if (!editId || recalculating || saving) return
    setErr('')
    setSuccessMsg('')
    setRecalculating(true)
    try {
      const calculatedPoints = getCalculatedPoints(form)
      await updatePlayer(editId, {
        ...buildStatsUpdatePayload(form),
        calculated_value: calculatedPoints
      })
      // Re-price the cohort with this player's current stats applied.
      const updatedList = players.map((p) => (
        p.id === editId ? { ...form, calculated_value: calculatedPoints } : p
      ))
      const priceById = await persistBasePrices(updatedList)
      const refreshed = await listPlayers(auction.id)
      setPlayers(refreshed)
      const saved = refreshed.find((p) => p.id === editId)
      if (saved) setForm({ ...blankFor(auction), ...saved })
      else setForm((s) => ({ ...s, calculated_value: calculatedPoints, base_price: priceById[editId] ?? s.base_price }))
      setSuccessMsg(`Points recalculated for ${form.name?.trim() || 'player'}.`)
    } catch (e) {
      setErr(e?.message || 'Recalculate failed. Please try again.')
    } finally {
      setRecalculating(false)
    }
  }

  const save = async () => {
    setErr('')
    setSuccessMsg('')
    setSaving(true)
    try {
      const isEdit = Boolean(editId)
      const savedName = form.name?.trim() || 'Player'
      if (isEdit) {
        const previous = players.find((p) => p.id === editId)
        if (previous?.status === 'sold' && form.status === 'ready_for_auction') {
          throw new Error('Sold players cannot be moved directly to Ready for auction. Use Re-auction from Auction Results or Auction Console.')
        }
      }
      // Base price is set via "Recalculate base prices" (cohort-relative),
      // not on save — keep whatever the admin entered here.
      const payload = { ...form, auction_id: auction.id }
      if (editId) await updatePlayer(editId, payload)
      else await createPlayer(payload)
      const refreshed = await listPlayers(auction.id)
      setPlayers(refreshed)
      if (isEdit) {
        // Stay on the player just saved: keep edit mode and repopulate the
        // form from the persisted row so the admin can keep working on them.
        const saved = refreshed.find((p) => p.id === editId)
        if (saved) setForm({ ...blankFor(auction), ...saved })
      } else {
        // New player: clear the form so the next one can be added.
        setEditId(null)
        setForm(blankFor(auction))
      }
      setSuccessMsg(
        isEdit
          ? `${savedName} profile updated successfully.`
          : `New player profile saved for ${savedName}.`
      )
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

  const fetchFromPlayHQ = async () => {
    if (!form.playhq_url) { setErr('Enter a Play Cricket profile URL first.'); return }
    setErr(''); setFetchingPlayHQ(true)
    try {
      const stats = await fetchPlayHQStats(form.playhq_url)
      setForm((s) => mergeFetchedStats(s, stats))
    } catch (e) {
      setErr(`Play Cricket fetch failed: ${e.message}`)
    } finally {
      setFetchingPlayHQ(false)
    }
  }

  const toggleApprove = async (p) => {
    if (p.status === 'sold') {
      setErr('Sold players must be returned via Re-auction, not Ready for auction.')
      return
    }
    const next = p.status === 'ready_for_auction'
      ? 'registered'
      : p.status === 'unsold'
        ? 'reauction'
        : 'ready_for_auction'
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
      const selectedPlayers = players.filter((p) => selected.has(p.id))
      if (status === 'ready_for_auction' && selectedPlayers.some((p) => p.status === 'sold')) {
        throw new Error('One or more selected players are sold. Use Re-auction to return sold players to bidding.')
      }
      await Promise.all(
        selectedPlayers.map((p) => {
          const nextStatus = status === 'ready_for_auction' && p.status === 'unsold'
            ? 'reauction'
            : status
          return updatePlayer(p.id, { status: nextStatus })
        })
      )
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
          await new Promise(r => setTimeout(r, 200))
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
      <RoleGate allow={['admin', 'team_owner']}>
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-teal-700/40 pb-px mb-5 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); navigate(`/players?tab=${encodeURIComponent(t)}`, { replace: true }) }}
              className={`px-4 py-2 va-body font-medium rounded-t-lg transition ${tab === t ? 'bg-ink-800/60 text-gold border border-teal-700/40 border-b-transparent -mb-px' : 'text-teal-300 hover:text-white'}`}>
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
              {role === 'admin' && (
                <button
                  onClick={() => {
                    setEditId(viewPlayer.id)
                    setForm({ ...blankFor(auction), ...viewPlayer })
                    setErr('')
                    setSuccessMsg('')
                    setTab('Add Player')
                    navigate('/players?tab=Add%20Player', { replace: true })
                    setViewPlayer(null)
                  }}
                  className="va-body mt-3 w-full py-2 text-gold hover:text-white bg-ink-800/80 border border-gold/35 rounded-xl"
                >
                  Edit profile
                </button>
              )}
              <button onClick={() => setViewPlayer(null)}
                className="va-body mt-3 w-full py-2 text-teal-300 hover:text-white bg-ink-800/80 border border-teal-700/40 rounded-xl">
                Close
              </button>
            </div>
          </div>
        )}

        {(tab === 'Players' || tab === 'Add Player') && (
          <div className={tab === 'Add Player' ? '' : 'grid gap-4 xl:grid-cols-3'}>
            {/* Create / Edit form */}
            {tab === 'Add Player' && (
              <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="va-section-title text-teal-200">{editId ? 'Edit player' : 'Add player'}</h3>
                  {editId && (
                    <button onClick={() => { setEditId(null); setForm(blankFor(auction)); setErr('') }}
                      className="va-micro text-teal-400 hover:text-white transition">✕ Cancel edit</button>
                  )}
                </div>

                {/* Step indicator */}
                <div className="flex items-center mb-6">
                  <button onClick={() => setAddStep(1)}
                    className={`va-micro flex items-center gap-1.5 font-medium whitespace-nowrap ${addStep === 1 ? 'text-gold' : addStep > 1 ? 'text-teal-400' : 'text-teal-600'}`}>
                    <span className={`va-micro h-6 w-6 rounded-full grid place-items-center font-bold shrink-0 ${addStep === 1 ? 'bg-gold text-ink-900' : addStep > 1 ? 'bg-teal-700/60 text-teal-200' : 'bg-ink-900 border border-teal-700/40 text-teal-600'}`}>1</span>
                    <span className="hidden sm:inline">Identity</span>
                  </button>
                  <div className={`flex-1 h-px mx-2 ${addStep > 1 ? 'bg-teal-500' : 'bg-teal-700/30'}`} />
                  <button onClick={() => setAddStep(2)}
                    className={`va-micro flex items-center gap-1.5 font-medium whitespace-nowrap ${addStep === 2 ? 'text-gold' : addStep > 2 ? 'text-teal-400' : 'text-teal-600'}`}>
                    <span className={`va-micro h-6 w-6 rounded-full grid place-items-center font-bold shrink-0 ${addStep === 2 ? 'bg-gold text-ink-900' : addStep > 2 ? 'bg-teal-700/60 text-teal-200' : 'bg-ink-900 border border-teal-700/40 text-teal-600'}`}>2</span>
                    <span className="hidden sm:inline">Batting</span>
                  </button>
                  <div className={`flex-1 h-px mx-2 ${addStep > 2 ? 'bg-teal-500' : 'bg-teal-700/30'}`} />
                  <button onClick={() => setAddStep(3)}
                    className={`va-micro flex items-center gap-1.5 font-medium whitespace-nowrap ${addStep === 3 ? 'text-gold' : 'text-teal-600'}`}>
                    <span className={`va-micro h-6 w-6 rounded-full grid place-items-center font-bold shrink-0 ${addStep === 3 ? 'bg-gold text-ink-900' : 'bg-ink-900 border border-teal-700/40 text-teal-600'}`}>3</span>
                    <span className="hidden sm:inline">Bowling &amp; Fielding</span>
                  </button>
                </div>

                {/* Step 1: Identity */}
                {addStep === 1 && (
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <label className="va-micro block text-teal-300">
                        Full name *
                        <input type="text" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)}
                          className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="va-micro block text-teal-300">
                          Role
                          <input type="text" value={form.role ?? ''} onChange={(e) => set('role', e.target.value)}
                            className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                        </label>
                        <label className="va-micro block text-teal-300">
                          Category
                          <input type="text" value={form.category ?? ''} onChange={(e) => set('category', e.target.value)}
                            className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                        </label>
                        <label className="va-micro block text-teal-300">
                          Status
                          <select value={form.status} onChange={(e) => set('status', e.target.value)}
                            className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white">
                            {['not_registered','registered','ready_for_auction','in_auction','sold','unsold','reauction','retired'].map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                            ))}
                          </select>
                        </label>
                        <label className="va-micro block text-teal-300">
                          Base price
                          <input type="text" inputMode="numeric" value={form.base_price ?? ''}
                            onChange={(e) => set('base_price', Number(e.target.value.replace(/[^\d.]/g, '') || 0))}
                            className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                        </label>
                        <label className="va-micro block text-teal-300">
                          Batting style
                          <input type="text" value={form.batting_style ?? ''} onChange={(e) => set('batting_style', e.target.value)}
                            className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                        </label>
                        <label className="va-micro block text-teal-300">
                          Bowling style
                          <input type="text" value={form.bowling_style ?? ''} onChange={(e) => set('bowling_style', e.target.value)}
                            className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                        </label>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-lg border border-teal-700/30 bg-ink-900/40 p-3 space-y-2">
                        <p className="va-label font-semibold text-teal-400">CricHeroes</p>
                        <div className="flex gap-2">
                          <input type="text" value={form.profile_url ?? ''}
                            onChange={(e) => set('profile_url', e.target.value)}
                            placeholder="https://cricheroes.com/player-profile/..."
                            className="va-body flex-1 min-w-0 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                          <button type="button" onClick={fetchFromCricHeroes}
                            disabled={fetchingStats || !form.profile_url}
                            className="va-micro px-3 py-2 rounded-lg bg-teal-600/70 text-white font-semibold whitespace-nowrap disabled:opacity-40">
                            {fetchingStats ? 'Fetching…' : 'Fetch'}
                          </button>
                        </div>
                      </div>
                      <div className="rounded-lg border border-teal-700/30 bg-ink-900/40 p-3 space-y-2">
                        <p className="va-label font-semibold text-teal-400">Play Cricket</p>
                        <div className="flex gap-2">
                          <input type="text" value={form.playhq_url ?? ''}
                            onChange={(e) => set('playhq_url', e.target.value)}
                            placeholder="https://play.cricket.com.au/player/{uuid}/{name}?tab=career"
                            className="va-body flex-1 min-w-0 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                          <button type="button" onClick={fetchFromPlayHQ}
                            disabled={fetchingPlayHQ || !form.playhq_url}
                            className="va-micro px-3 py-2 rounded-lg bg-teal-600/70 text-white font-semibold whitespace-nowrap disabled:opacity-40">
                            {fetchingPlayHQ ? 'Fetching…' : 'Fetch'}
                          </button>
                        </div>
                      </div>
                      <div className="rounded-lg border border-teal-700/30 bg-ink-900/40 p-3 space-y-2">
                        <p className="va-label font-semibold text-teal-400">Photo</p>
                        <div className="flex items-center gap-3">
                          {form.photo_url ? (
                            <img src={form.photo_url} alt="" className="h-20 w-20 rounded-lg object-cover border border-teal-700/40 shrink-0" />
                          ) : (
                            <div className="h-20 w-20 rounded-lg bg-ink-900 border border-teal-700/40 grid place-items-center shrink-0">
                              <span className="text-teal-600 text-2xl">?</span>
                            </div>
                          )}
                          <label className={`va-micro px-3 py-2 rounded-lg cursor-pointer font-medium transition ${uploadingPhoto ? 'bg-teal-900/60 text-teal-400' : 'bg-teal-700/50 text-white hover:bg-teal-700/70'}`}>
                            {uploadingPhoto ? 'Uploading…' : 'Upload photo'}
                            <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f) }} />
                          </label>
                        </div>
                      </div>
                      {duplicates.length > 0 && (
                        <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 p-3">
                          <p className="va-micro text-yellow-400 font-semibold">Possible duplicate{duplicates.length > 1 ? 's' : ''} found:</p>
                          <ul className="va-micro text-yellow-300 mt-1 space-y-0.5">
                            {duplicates.map((d) => <li key={d.id}>{d.name} — {d.role} ({d.status})</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Batting */}
                {addStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {[
                        { key: 'matches', label: 'Matches' },
                        { key: 'runs', label: 'Runs' },
                        { key: 'bat_avg', label: 'Average' },
                        { key: 'strike_rate', label: 'Strike rate' },
                        { key: 'fifties', label: '50s' },
                        { key: 'hundreds', label: '100s' },
                        { key: 'sixes', label: 'Sixes' },
                      ].map(({ key, label }) => (
                        <label key={key} className="va-micro block text-teal-300">
                          {label}
                          <input type="text" inputMode="numeric" value={form[key] ?? ''}
                            onChange={(e) => set(key, Number(e.target.value.replace(/[^\d.]/g, '') || 0))}
                            className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                        </label>
                      ))}
                    </div>
                    {form.matches > 0 && (
                      <div className="rounded-lg border border-teal-700/40 bg-ink-900/50 p-3">
                        <p className="va-label font-semibold text-teal-200 mb-2">Calculated Points (PPM)</p>
                        <div className="va-micro grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                          <span className="text-teal-400">Batting:</span><span className="text-white">{calcBattingPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400">Bowling:</span><span className="text-white">{calcBowlingPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400">Fielding:</span><span className="text-white">{calcFieldingPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400 font-semibold">Total:</span><span className="text-white font-semibold">{calcTotalPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400 font-semibold">PPM:</span>
                          <span className={`font-semibold col-span-3 ${formTier.color}`}>{calcPPM(form).toFixed(2)} ({formTier.label})</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Bowling & Fielding */}
                {addStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <p className="va-label font-semibold text-teal-400 mb-3">Bowling</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'wickets', label: 'Wickets' },
                          { key: 'bowl_avg', label: 'Average' },
                          { key: 'economy', label: 'Economy' },
                          { key: 'dot_balls', label: 'Dot balls' },
                          { key: 'three_wicket_hauls', label: '3-wkt hauls' },
                          { key: 'five_wicket_hauls', label: '5-wkt hauls' },
                        ].map(({ key, label }) => (
                          <label key={key} className="va-micro block text-teal-300">
                            {label}
                            <input type="text" inputMode="numeric" value={form[key] ?? ''}
                              onChange={(e) => set(key, Number(e.target.value.replace(/[^\d.]/g, '') || 0))}
                              className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="va-label font-semibold text-teal-400 mb-3">Fielding</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'catches', label: 'Catches' },
                          { key: 'run_outs', label: 'Run outs' },
                          { key: 'stumpings', label: 'Stumpings' },
                        ].map(({ key, label }) => (
                          <label key={key} className="va-micro block text-teal-300">
                            {label}
                            <input type="text" inputMode="numeric" value={form[key] ?? ''}
                              onChange={(e) => set(key, Number(e.target.value.replace(/[^\d.]/g, '') || 0))}
                              className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                          </label>
                        ))}
                      </div>
                    </div>
                    {form.matches > 0 && (
                      <div className="rounded-lg border border-teal-700/40 bg-ink-900/50 p-3">
                        <p className="va-label font-semibold text-teal-200 mb-2">Calculated Points (PPM)</p>
                        <div className="va-micro grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                          <span className="text-teal-400">Batting:</span><span className="text-white">{calcBattingPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400">Bowling:</span><span className="text-white">{calcBowlingPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400">Fielding:</span><span className="text-white">{calcFieldingPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400 font-semibold">Total:</span><span className="text-white font-semibold">{calcTotalPoints(form).toFixed(1)}</span>
                          <span className="text-teal-400 font-semibold">PPM:</span>
                          <span className={`font-semibold col-span-3 ${formTier.color}`}>{calcPPM(form).toFixed(2)} ({formTier.label})</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {successMsg && (
                  <p className="va-support mt-3 rounded-lg border border-green-600/40 bg-green-900/20 px-3 py-2 text-green-400">
                    {successMsg}
                  </p>
                )}
                {err && <p className="va-support text-red-400 mt-3">{err}</p>}
                <div className="flex items-center gap-3 mt-5">
                  {addStep > 1 && (
                    <button type="button" onClick={() => setAddStep(s => s - 1)}
                      className="va-body px-4 py-2 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white transition">
                      ← Previous
                    </button>
                  )}
                  {addStep < 3 && (
                    <button type="button" onClick={() => setAddStep(s => s + 1)}
                      className="va-body px-4 py-2 rounded-lg border border-teal-500/50 text-teal-200 hover:text-white hover:border-teal-400 transition">
                      Next →
                    </button>
                  )}
                  {editId && (
                    <button type="button" onClick={recalculateForm}
                      disabled={recalculating || saving}
                      className="va-body ml-auto px-4 py-2 rounded-lg border border-teal-500/50 text-teal-200 hover:text-white hover:border-teal-400 disabled:opacity-50 transition">
                      {recalculating ? 'Calculating…' : 'Recalculate points'}
                    </button>
                  )}
                  <button onClick={save} disabled={!form.name || saving || uploadingPhoto}
                    className={`va-body ${editId ? '' : 'ml-auto'} px-5 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50`}>
                    {saving ? 'Saving…' : 'Save player'}
                  </button>
                </div>
              </div>
            )}

            {/* Player list */}
            <div className={`${tab === 'Players' ? 'xl:col-span-3' : 'hidden'} rounded-xl border border-teal-700/40 bg-ink-800/60 p-4`}>
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => download('players-template.csv', playersCsvTemplate())}
                  className="va-body px-3 py-1 rounded bg-teal-700/50">Download template</button>
                <button onClick={() => download('players-export.csv', exportPlayersCsv(players))}
                  className="va-body px-3 py-1 rounded bg-teal-700/50">Export CSV</button>
                <label className="va-body px-3 py-1 rounded bg-gold/80 text-ink-900 font-semibold cursor-pointer">
                  Bulk import CSV
                  <input type="file" accept=".csv,text/csv" className="hidden"
                    onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
                </label>
                <button
                  onClick={recalcAllBasePrices}
                  disabled={recalculating || players.length === 0}
                  title="Re-price every player relative to the full cohort (percentile → ₹500–₹10,000)"
                  className="va-body px-3 py-1 rounded bg-teal-600/70 text-white font-semibold disabled:opacity-50"
                >
                  {recalculating ? 'Recalculating…' : 'Recalculate base prices'}
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={bulkFetchAndRecalculateSelected}
                    disabled={bulkBusy}
                    className="va-body px-3 py-1 rounded bg-gold text-ink-900 font-semibold disabled:opacity-50"
                  >
                    {bulkBusy ? 'Processing…' : 'Fetch + Recalculate selected'}
                  </button>
                )}
              </div>

              {report && (
                <div className="va-body mb-3 rounded-lg border border-teal-600/40 bg-teal-900/20 p-3">
                  <p className="text-teal-200">Imported <b>{report.inserted}</b> of {report.total} rows. Skipped {report.skipped}.</p>
                  {report.failures.length > 0 && (
                    <ul className="va-micro mt-1 text-red-400 list-disc pl-4 max-h-28 overflow-y-auto">
                      {report.failures.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {bulkSyncReport && (
                <div className="va-body mb-3 rounded-lg border border-teal-600/40 bg-teal-900/20 p-3">
                  <p className="text-teal-200">
                    Bulk fetch/recalculate completed. Success: <b>{bulkSyncReport.success}</b> ·
                    Skipped: <b>{bulkSyncReport.skipped.length}</b> ·
                    Failed: <b>{bulkSyncReport.failed.length}</b>
                  </p>
                  {[...bulkSyncReport.skipped, ...bulkSyncReport.failed].length > 0 && (
                    <ul className="va-micro mt-1 text-red-400 list-disc pl-4 max-h-28 overflow-y-auto">
                      {[...bulkSyncReport.skipped, ...bulkSyncReport.failed].map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Search */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search players…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="va-body w-full max-w-xs rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-1.5 text-white placeholder:text-teal-600"
                />
              </div>

              {/* Status filter tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => setStatusFilter(null)}
                  className={`va-micro px-2.5 py-1 rounded-full font-medium transition ${!statusFilter ? 'bg-teal-600 text-white' : 'bg-ink-900 border border-teal-700/50 text-teal-300 hover:text-white'}`}>
                  All ({players.length})
                </button>
                {['not_registered', 'registered', 'ready_for_auction', 'in_auction', 'sold', 'unsold', 'retired'].map((s) => {
                  const count = statusCounts[s] || 0
                  if (count === 0 && s !== 'ready_for_auction' && s !== 'registered') return null
                  const colors = {
                    not_registered: 'bg-gray-800/60 border-gray-600/50 text-gray-400',
                    registered: 'bg-blue-900/40 border-blue-600/50 text-blue-400',
                    ready_for_auction: 'bg-green-900/40 border-green-600/50 text-green-400',
                    in_auction: 'bg-yellow-900/40 border-yellow-600/50 text-yellow-400',
                    sold: 'bg-gold/20 border-gold/50 text-gold',
                    unsold: 'bg-red-900/40 border-red-600/50 text-red-400',
                    retired: 'bg-slate-800/60 border-slate-600/50 text-slate-400',
                  }
                  const tooltip = s === 'registered' ? 'Club member — not playing this season' : undefined
                  return (
                    <button key={s} title={tooltip} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                      className={`va-micro px-2.5 py-1 rounded-full font-medium border transition ${statusFilter === s ? colors[s] : 'bg-ink-900 border-teal-700/50 text-teal-300 hover:text-white'}`}>
                      {STATUS_LABELS[s]} ({count})
                    </button>
                  )
                })}
              </div>

              {filteredPlayers.length > 0 && (
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <label className="va-micro flex items-center gap-1.5 text-teal-300 cursor-pointer">
                    <input type="checkbox"
                      checked={selected.size === filteredPlayers.length && filteredPlayers.length > 0}
                      onChange={selectAll} />
                    {selected.size === 0 ? 'Select all' : `${selected.size} selected`}
                  </label>
                  {selected.size > 0 && (
                    <>
                      <button onClick={() => bulkSetStatus('ready_for_auction')} disabled={bulkBusy}
                        className="va-micro px-2 py-1 rounded bg-green-700/60 text-white disabled:opacity-50">
                        {bulkBusy ? '…' : '✓ Ready for auction'}
                      </button>
                      <button onClick={() => bulkSetStatus('registered')} disabled={bulkBusy}
                        className="va-micro px-2 py-1 rounded bg-ink-900 border border-teal-700/50 disabled:opacity-50">
                        {bulkBusy ? '…' : 'Move to registered'}
                      </button>
                      <button onClick={() => bulkSetStatus('retired')} disabled={bulkBusy}
                        className="va-micro px-2 py-1 rounded bg-slate-800/60 border border-slate-600/50 text-slate-400 disabled:opacity-50">
                        {bulkBusy ? '…' : 'Retire selected'}
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
                              : <span className="va-micro text-teal-500">no img</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="va-body font-medium text-white truncate">
                              <button onClick={() => setViewPlayer(p)} className="hover:text-gold transition text-left">
                                {p.name}
                              </button>
                              <span className="va-micro text-teal-500"> · {p.role}{p.category ? ` / ${p.category}` : ''}</span>
                            </p>
                            <p className="va-micro text-teal-300">
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
                          {p.status !== 'retired' && (
                            <button onClick={() => toggleApprove(p)}
                              className={`va-micro px-2 py-1 rounded ${p.status === 'ready_for_auction' ? 'bg-green-700/50 text-white' : 'bg-ink-900 border border-teal-700/50 text-teal-300'}`}>
                              {p.status === 'ready_for_auction'
                                ? '✓ Ready — Remove'
                                : p.status === 'unsold'
                                  ? 'Set Re-auction'
                                  : 'Set Ready for Auction'}
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              await updatePlayer(p.id, { status: p.status === 'retired' ? 'registered' : 'retired' })
                              await reloadPlayers()
                            }}
                            className={`va-micro px-2 py-1 rounded ${p.status === 'retired' ? 'bg-teal-700/50 text-teal-200' : 'bg-slate-800/60 border border-slate-600/50 text-slate-400'}`}>
                            {p.status === 'retired' ? 'Unretire' : 'Retire'}
                          </button>
                          <button onClick={() => { setEditId(p.id); setForm({ ...blankFor(auction), ...p }); setErr(''); setTab('Add Player') }}
                            className="va-micro px-2 py-1 rounded bg-teal-700/50">Edit</button>
                          <button onClick={async () => {
                            if (!window.confirm(`Delete player "${p.name}"? This cannot be undone.`)) return
                            await deletePlayer(p.id); reloadPlayers()
                          }}
                            className="va-micro px-2 py-1 rounded bg-red-900/50">Delete</button>
                        </div>
                      </div>
                      {/* Points breakdown row */}
                      {p.matches > 0 && (
                        <div className="va-micro flex flex-wrap gap-x-4 gap-y-1 text-teal-400 sm:ml-[3.25rem]">
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
                {filteredPlayers.length === 0 && <p className="va-support text-teal-500">{players.length === 0 ? 'No players yet — add one or bulk import.' : 'No players match this filter.'}</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'Vacation' && (
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
            <h3 className="va-section-title text-teal-200 mb-4">Player Vacation Dates</h3>
            {(() => {
              const onVacation = players.filter(p => (p.vacation_dates ?? []).length > 0)
              if (onVacation.length === 0) {
                return <p className="va-support text-teal-500">No players have submitted vacation dates.</p>
              }
              return (
                <div className="space-y-3">
                  {onVacation.map(p => (
                    <div key={p.id} className="border border-teal-700/40 rounded-lg p-3 flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-ink-900 border border-teal-700/40 overflow-hidden grid place-items-center shrink-0">
                        {p.photo_url
                          ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                          : <span className="va-micro text-teal-500">no img</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="va-body font-medium text-white">{p.name}
                            <span className="va-micro text-teal-400 ml-2">{p.role}{p.category ? ` / ${p.category}` : ''}</span>
                          </p>
                          <button
                            onClick={async () => { await updatePlayerVacation(p.id, []); await reloadPlayers() }}
                            className="va-micro shrink-0 px-2 py-1 rounded border border-red-700/40 text-red-400 hover:bg-red-900/30 transition"
                          >
                            Reset dates
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(p.vacation_dates ?? []).map(d => (
                            <span key={d} className="va-micro px-2 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700/40 text-yellow-300">
                              {new Date(d).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {tab === 'Categories' && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Description card */}
            <div className="md:col-span-3 rounded-xl border border-teal-600/30 bg-teal-900/20 p-4">
              <p className="va-body font-semibold text-teal-200 mb-1">📂 What are Categories?</p>
              <p className="va-support text-teal-300 leading-relaxed">
                Categories group players by role (e.g. <span className="text-white">Wicketkeeper</span>, <span className="text-white">Batter</span>, <span className="text-white">Bowler</span>) so each team must pick the right mix.
                Set a <span className="text-white">Minimum required</span> to enforce squad balance — every team must buy at least that many from this group.
                Set a <span className="text-white">Maximum allowed</span> to cap how many a team can buy (leave 0 for no cap).
                The <span className="text-white">Sequence order</span> controls the order in which categories go to auction — lower number goes first.
              </p>
            </div>
            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
              <label className="va-label block text-teal-300">
                Category name
                <input placeholder="e.g. Wicketkeeper" value={catForm.name}
                  onChange={(e) => setCatForm((s) => ({ ...s, name: e.target.value }))}
                  className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              </label>
              {['sequence_order', 'minimum_required', 'maximum_allowed'].map((f) => (
                <label key={f} className="va-label block text-teal-300">
                  {CAT_FIELD_LABELS[f]}
                  <input placeholder={CAT_FIELD_LABELS[f]} value={catForm[f]}
                    onChange={(e) => setCatForm((s) => ({ ...s, [f]: Number(e.target.value || 0) }))}
                    className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
                </label>
              ))}
              <button onClick={saveCat} className="va-body px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold">Save</button>
            </div>
            <div className="md:col-span-2 rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="border border-teal-700/40 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between gap-2">
                  <div>
                    <p className="va-body font-medium">{c.sequence_order}. {c.name}</p>
                    <p className="va-micro text-teal-300">Min {c.minimum_required} · Max {c.maximum_allowed ?? '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setCatEditId(c.id); setCatForm(c) }} className="va-micro px-2 py-1 rounded bg-teal-700/50">Edit</button>
                    <button onClick={async () => {
                      if (!window.confirm(`Delete category "${c.name}"? This cannot be undone.`)) return
                      await deleteCategory(c.id); reloadCategories()
                    }} className="va-micro px-2 py-1 rounded bg-live/40">Delete</button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="va-support text-teal-500">No categories yet.</p>}
            </div>
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
