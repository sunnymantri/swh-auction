import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useAuctionContext } from '../context/AuctionContext'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { createAuction, setAuctionStatus, updateAuction, uploadBranding, resetAuction, recalculateTeamBudgets } from '../lib/api'
import { fmtPoints } from '../lib/format'

const STATUSES = ['draft', 'live', 'paused', 'completed']
const NUMERIC = ['squad_size', 'default_team_budget', 'default_base_price', 'min_player_price', 'initial_bid_timer_seconds', 'bid_timer_seconds']
const TABS = ['Auctions', 'Configuration']

const blankAuction = {
  name: '', season: '', sport: 'Cricket', squad_size: 11,
  default_team_budget: 100000, default_base_price: 500,
  min_player_price: 500, reauction_refund_enabled: true
}

export default function Auctions() {
  const { auctions, auctionId, selectAuction, reload } = useAuctionContext()
  const { auction } = useActiveAuction()
  const nav = useNavigate()
  const [tab, setTab] = useState('Auctions')
  const [form, setForm] = useState(blankAuction)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Configuration state
  const [cfgForm, setCfgForm] = useState(null)
  const [cfgMsg, setCfgMsg] = useState('')
  const [cfgBusy, setCfgBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [recalcBusy, setRecalcBusy] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingSponsor, setUploadingSponsor] = useState(false)
  const STATUS_TRANSITIONS = {
    draft: ['draft', 'live'],
    live: ['live', 'paused', 'completed'],
    paused: ['paused', 'live', 'completed'],
    completed: ['completed']
  }

  useEffect(() => {
    if (auction) setCfgForm({ ...auction, sponsor_logos: Array.isArray(auction.sponsor_logos) ? auction.sponsor_logos : [] })
  }, [auction])

  const create = async () => {
    setBusy(true); setError('')
    try {
      const a = await createAuction({ ...form, status: 'draft' })
      await reload()
      selectAuction(a.id)
      setForm(blankAuction)
      setTab('Configuration')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (id, status) => {
    const current = auctions.find((a) => a.id === id)?.status
    if (current && !(STATUS_TRANSITIONS[current] || []).includes(status)) {
      setError(`Invalid status transition from ${current} to ${status}.`)
      return
    }
    await setAuctionStatus(id, status)
    await reload()
  }

  // Configuration handlers
  const cfgSet = (k, v) => setCfgForm((s) => ({ ...s, [k]: v }))

  const saveCfg = async () => {
    setCfgBusy(true); setCfgMsg('')
    try {
      const payload = {
        name: cfgForm.name, season: cfgForm.season, sport: cfgForm.sport,
        auction_date: cfgForm.auction_date || null, auction_time: cfgForm.auction_time || null,
        season_start_date: cfgForm.season_start_date || null,
        season_end_date: cfgForm.season_end_date || null,
        timezone: cfgForm.timezone || 'Australia/Sydney',
        match_day: cfgForm.match_day || 'Sunday',
        squad_size: Number(cfgForm.squad_size || 0),
        default_team_budget: Number(cfgForm.default_team_budget || 0),
        default_base_price: Number(cfgForm.default_base_price || 0),
        min_player_price: Number(cfgForm.min_player_price || 0),
        initial_bid_timer_seconds: Number(cfgForm.initial_bid_timer_seconds || 90),
        bid_timer_seconds: Number(cfgForm.bid_timer_seconds || 15),
        budget_multiplier: Number(cfgForm.budget_multiplier || 1.6),
        reauction_refund_enabled: !!cfgForm.reauction_refund_enabled,
        banner_logo_url: cfgForm.banner_logo_url || null,
        sponsor_logos: cfgForm.sponsor_logos || []
      }
      await updateAuction(auction.id, payload)
      await reload()
      setCfgMsg('Saved.')
    } catch (e) {
      setCfgMsg(e.message)
    } finally {
      setCfgBusy(false)
    }
  }

  const onBanner = async (file) => {
    setUploadErr(''); setUploadingBanner(true)
    try {
      const url = await uploadBranding(file)
      cfgSet('banner_logo_url', url)
    } catch (e) {
      setUploadErr(`Banner upload failed: ${e.message}`)
    } finally {
      setUploadingBanner(false)
    }
  }

  const addSponsor = async (file) => {
    setUploadErr(''); setUploadingSponsor(true)
    try {
      const url = await uploadBranding(file)
      cfgSet('sponsor_logos', [...(cfgForm.sponsor_logos || []), { name: file.name, url }])
    } catch (e) {
      setUploadErr(`Sponsor upload failed: ${e.message}`)
    } finally {
      setUploadingSponsor(false)
    }
  }

  const removeSponsor = (i) => cfgSet('sponsor_logos', cfgForm.sponsor_logos.filter((_, idx) => idx !== i))

  const handleResetAuction = async () => {
    if (!auction) return
    const typed = window.prompt(`Type RESET to confirm reset for "${auction.name}".`)
    if (typed !== 'RESET') return
    setResetBusy(true)
    setCfgMsg('')
    try {
      await resetAuction(auction.id)
      await reload()
      setCfgMsg('Auction reset complete.')
    } catch (e) {
      setCfgMsg(e.message || 'Auction reset failed.')
    } finally {
      setResetBusy(false)
    }
  }

  const handleRecalculateBudgets = async () => {
    if (!auction) return
    if (!window.confirm(
      'Recalculate team budgets from the current ready-for-auction player pool?\n\n' +
      'Budgets are reset to the new value. This is only valid before the auction starts — ' +
      'the server will block this if any sales already exist.'
    )) return
    setRecalcBusy(true)
    setCfgMsg('')
    try {
      const budget = await recalculateTeamBudgets(auction.id)
      await reload()
      setCfgMsg(`Team budgets recalculated to ${fmtPoints(Number(budget || 0))} per team.`)
    } catch (e) {
      setCfgMsg(e.message || 'Budget recalculation failed.')
    } finally {
      setRecalcBusy(false)
    }
  }

  return (
    <AppShell title="Auctions">
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

        {tab === 'Auctions' && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-2">
              {auctions.map((a) => (
                <div key={a.id}
                  className={`rounded-xl border p-4 transition ${
                    a.id === auctionId
                      ? 'border-gold/50 bg-gold/5 shadow-glow'
                      : 'border-teal-700/40 bg-ink-800/60 hover:border-teal-600/60'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-score text-xl text-white">{a.name}</p>
                        <span className={`text-[0.7rem] sm:text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                          a.status === 'live'
                            ? 'bg-gold/20 text-gold'
                            : a.status === 'completed'
                            ? 'bg-teal-900/60 text-teal-400'
                            : 'bg-ink-900 text-teal-300 border border-teal-700/40'
                        }`}>{a.status}</span>
                        {a.id === auctionId && (
                          <span className="text-[0.7rem] sm:text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 font-semibold">SELECTED</span>
                        )}
                      </div>
                      <p className="text-xs text-teal-400 mt-1">
                        {a.season} · squad {a.squad_size} · budget {fmtPoints(a.default_team_budget)}
                      </p>
                    </div>
                    <select value={a.status} onChange={(e) => changeStatus(a.id, e.target.value)}
                      className="rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1.5 text-xs text-white shrink-0">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {a.id !== auctionId && (
                      <button onClick={() => selectAuction(a.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-teal-700/40 hover:bg-teal-700/70 text-teal-200 transition">Select</button>
                    )}
                    <button onClick={() => { selectAuction(a.id); setTab('Configuration') }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-ink-900 border border-teal-700/40 hover:border-teal-500 text-teal-200 transition">Configure</button>
                    <button onClick={() => { selectAuction(a.id); nav('/auction') }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-ink-900 border border-teal-700/40 hover:border-gold/40 text-teal-200 transition">Auction Centre</button>
                  </div>
                </div>
              ))}
              {auctions.length === 0 && <p className="text-teal-500 text-sm">No auctions yet — create one.</p>}
            </div>

            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2 h-fit">
              <h3 className="font-score text-lg text-teal-200">New auction</h3>
              <input placeholder="Name" value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              <input placeholder="Season" value={form.season}
                onChange={(e) => setForm((s) => ({ ...s, season: e.target.value }))}
                className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
              <label className="block text-xs text-teal-300">
                Sport
                <select value={form.sport} onChange={(e) => setForm((s) => ({ ...s, sport: e.target.value }))}
                  className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white">
                  <option value="Cricket">Cricket</option>
                  <option value="Football">Football</option>
                  <option value="Basketball">Basketball</option>
                  <option value="Rugby">Rugby</option>
                </select>
              </label>
              {[
                ['squad_size', 'Squad size'], ['default_team_budget', 'Team budget'],
                ['default_base_price', 'Base price'],
                ['min_player_price', 'Min player price']
              ].map(([k, label]) => (
                <label key={k} className="block text-xs text-teal-300">
                  {label}
                  <input value={form[k]} inputMode="numeric"
                    onChange={(e) => setForm((s) => ({ ...s, [k]: Number(e.target.value.replace(/[^\d]/g, '') || 0) }))}
                    className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2" />
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm text-teal-200">
                <input type="checkbox" checked={form.reauction_refund_enabled}
                  onChange={(e) => setForm((s) => ({ ...s, reauction_refund_enabled: e.target.checked }))} />
                Re-auction refund enabled
              </label>
              <button onClick={create} disabled={busy || !form.name}
                className="w-full px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50">
                {busy ? 'Creating…' : 'Create auction'}
              </button>
              {error && <p className="text-live text-sm">{error}</p>}
            </div>
          </div>
        )}

        {tab === 'Configuration' && (
          <>
            {!auction || !cfgForm ? (
              <p className="text-teal-400">No auction selected. Switch to the Auctions tab and select or create one.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-3">
                  <h3 className="font-score text-lg text-teal-200">Rules & details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <CfgField label="Name" value={cfgForm.name} onChange={(v) => cfgSet('name', v)} />
                    <CfgField label="Season" value={cfgForm.season} onChange={(v) => cfgSet('season', v)} />
                    <CfgField label="Sport" value={cfgForm.sport} onChange={(v) => cfgSet('sport', v)} />
                    <CfgField label="Auction date" type="date" value={cfgForm.auction_date ?? ''} onChange={(v) => cfgSet('auction_date', v)} />
                    <CfgField label="Auction time" type="time" value={cfgForm.auction_time ?? ''} onChange={(v) => cfgSet('auction_time', v)} />
                    <CfgField label="Season start date" type="date" value={cfgForm.season_start_date ?? ''} onChange={(v) => cfgSet('season_start_date', v)} />
                    <CfgField label="Season end date" type="date" value={cfgForm.season_end_date ?? ''} onChange={(v) => cfgSet('season_end_date', v)} />
                    <label className="block text-xs text-teal-300 capitalize">
                      Match day
                      <select value={cfgForm.match_day ?? 'Sunday'} onChange={(e) => cfgSet('match_day', e.target.value)}
                        className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white">
                        {['Sunday','Saturday','Monday','Tuesday','Wednesday','Thursday','Friday'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-teal-300 capitalize">
                      Timezone
                      <select value={cfgForm.timezone ?? 'Australia/Sydney'} onChange={(e) => cfgSet('timezone', e.target.value)}
                        className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white">
                        {['Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Adelaide','Australia/Perth','Australia/Hobart','Pacific/Auckland','Asia/Kolkata','Asia/Singapore','Europe/London','America/New_York','America/Los_Angeles','UTC'].map(tz => (
                          <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </label>
                    {NUMERIC.map((k) => (
                      <CfgField key={k} label={k.replaceAll('_', ' ')} value={cfgForm[k] ?? ''}
                        onChange={(v) => cfgSet(k, Number(v.replace(/[^\d]/g, '') || 0))} />
                    ))}
                    <label className="block text-xs text-teal-300 capitalize">
                      Budget multiplier
                      <input type="text" inputMode="decimal" value={cfgForm.budget_multiplier ?? 1.6}
                        onChange={(e) => cfgSet('budget_multiplier', e.target.value.replace(/[^\d.]/g, ''))}
                        className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
                      <span className="text-[0.7rem] sm:text-xs text-teal-500 mt-0.5 block">
                        Team budget = (sum of ready-for-auction player base prices) × multiplier ÷ number of teams
                      </span>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-teal-200">
                    <input type="checkbox" checked={!!cfgForm.reauction_refund_enabled}
                      onChange={(e) => cfgSet('reauction_refund_enabled', e.target.checked)} />
                    Re-auction refund enabled
                  </label>
                  <button onClick={saveCfg} disabled={cfgBusy}
                    className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50">
                    {cfgBusy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={handleRecalculateBudgets}
                    disabled={recalcBusy}
                    className="ml-2 px-4 py-2 rounded-lg bg-teal-800/60 border border-teal-600/50 text-teal-100 font-semibold disabled:opacity-50"
                  >
                    {recalcBusy ? 'Recalculating…' : 'Recalculate team budgets'}
                  </button>
                  <button
                    onClick={handleResetAuction}
                    disabled={resetBusy}
                    className="ml-2 px-4 py-2 rounded-lg bg-red-900/60 border border-red-600/50 text-red-200 font-semibold disabled:opacity-50"
                  >
                    {resetBusy ? 'Resetting…' : 'Reset auction'}
                  </button>
                  {cfgMsg && <p className="text-teal-300 text-sm">{cfgMsg}</p>}
                </div>

                <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-3">
                  <h3 className="font-score text-lg text-teal-200">Branding</h3>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-lg bg-ink-900 border border-teal-700/40 grid place-items-center overflow-hidden">
                      {cfgForm.banner_logo_url
                        ? <img src={cfgForm.banner_logo_url} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xs text-teal-500">logo</span>}
                    </div>
                    <label className={`text-xs px-3 py-2 rounded cursor-pointer ${uploadingBanner ? 'bg-teal-900 text-teal-400' : 'bg-teal-700/50'}`}>
                      {uploadingBanner ? 'Uploading…' : 'Upload banner logo'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingBanner}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onBanner(f) }} />
                    </label>
                  </div>
                  {uploadErr && <p className="text-red-400 text-xs">{uploadErr}</p>}
                  <div>
                    <p className="text-xs text-teal-300 mb-1">Sponsor logos</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(cfgForm.sponsor_logos || []).map((s, i) => (
                        <div key={i} className="relative">
                          <img src={s.url} alt={s.name} className="h-10 object-contain rounded bg-ink-900 border border-teal-700/40 px-1" />
                          <button onClick={() => removeSponsor(i)}
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-live text-white text-xs">×</button>
                        </div>
                      ))}
                    </div>
                    <label className={`text-xs px-3 py-2 rounded cursor-pointer ${uploadingSponsor ? 'bg-teal-900 text-teal-400' : 'bg-teal-700/50'}`}>
                      {uploadingSponsor ? 'Uploading…' : 'Add sponsor logo'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingSponsor}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) addSponsor(f) }} />
                    </label>
                    <p className="text-[0.7rem] sm:text-xs text-teal-500 mt-1">Logo appears above — then click Save to persist.</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </RoleGate>
    </AppShell>
  )
}

function CfgField({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block text-xs text-teal-300 capitalize">
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
    </label>
  )
}
