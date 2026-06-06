import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useAuctionContext } from '../context/AuctionContext'
import { createAuction, setAuctionStatus } from '../lib/api'
import { fmtPoints } from '../lib/format'

const STATUSES = ['draft', 'live', 'paused', 'completed']

const blank = {
  name: '', season: '', sport: 'Cricket', squad_size: 11,
  default_team_budget: 100000, default_base_price: 500,
  default_bid_increment: 500, min_player_price: 500, reauction_refund_enabled: true
}

export default function Auctions() {
  const { auctions, auctionId, selectAuction, reload } = useAuctionContext()
  const nav = useNavigate()
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    setBusy(true); setError('')
    try {
      const a = await createAuction({ ...form, status: 'draft' })
      await reload()
      selectAuction(a.id)
      setForm(blank)
      nav('/setup')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (id, status) => {
    await setAuctionStatus(id, status)
    await reload()
  }

  return (
    <AppShell title="Auctions">
      <RoleGate allow={['admin']}>
        <div className="grid lg:grid-cols-[1fr_22rem] gap-4">
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
                      <span className={`text-[0.6rem] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        a.status === 'live'
                          ? 'bg-gold/20 text-gold'
                          : a.status === 'completed'
                          ? 'bg-teal-900/60 text-teal-400'
                          : 'bg-ink-900 text-teal-300 border border-teal-700/40'
                      }`}>{a.status}</span>
                      {a.id === auctionId && (
                        <span className="text-[0.6rem] px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 font-semibold">
                          SELECTED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-teal-400 mt-1">
                      {a.season} · squad {a.squad_size} · budget {fmtPoints(a.default_team_budget)}
                    </p>
                  </div>
                  <select
                    value={a.status}
                    onChange={(e) => changeStatus(a.id, e.target.value)}
                    className="rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-1.5 text-xs text-white shrink-0"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {a.id !== auctionId && (
                    <button
                      onClick={() => selectAuction(a.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-teal-700/40 hover:bg-teal-700/70 text-teal-200 transition"
                    >
                      Select
                    </button>
                  )}
                  <button
                    onClick={() => { selectAuction(a.id); nav('/setup') }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-ink-900 border border-teal-700/40 hover:border-teal-500 text-teal-200 transition"
                  >
                    ⚙ Configure
                  </button>
                  <button
                    onClick={() => { selectAuction(a.id); nav('/auction') }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-ink-900 border border-teal-700/40 hover:border-gold/40 text-teal-200 transition"
                  >
                    🎙 Auction Centre
                  </button>
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
              <select
                value={form.sport}
                onChange={(e) => setForm((s) => ({ ...s, sport: e.target.value }))}
                className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white"
              >
                <option value="Cricket">Cricket</option>
                <option value="Football">Football</option>
                <option value="Basketball">Basketball</option>
                <option value="Rugby">Rugby</option>
              </select>
            </label>
            {[
              ['squad_size', 'Squad size'],
              ['default_team_budget', 'Team budget'],
              ['default_base_price', 'Base price'],
              ['default_bid_increment', 'Bid increment'],
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
      </RoleGate>
    </AppShell>
  )
}
