import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionContext } from '../context/AuctionContext'
import { updateAuction, uploadBranding } from '../lib/api'

const NUMERIC = [
  { key: 'squad_size',                  label: 'Squad size' },
  { key: 'default_team_budget',         label: 'Default team budget' },
  { key: 'default_base_price',          label: 'Default base price' },
  { key: 'min_player_price',            label: 'Min player price' },
  { key: 'initial_bid_timer_seconds',   label: 'Initial timer on player start (s)' },
  { key: 'bid_timer_seconds',           label: 'Post-bid reset timer (s)' },
]

export default function AuctionSetup() {
  const { auction } = useActiveAuction()
  const { reload } = useAuctionContext()
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingSponsor, setUploadingSponsor] = useState(false)

  useEffect(() => {
    if (auction) setForm({ ...auction, sponsor_logos: Array.isArray(auction.sponsor_logos) ? auction.sponsor_logos : [] })
  }, [auction])

  if (!auction || !form) {
    return (
      <AppShell title="Auction Setup">
        <RoleGate allow={['admin']}>
          <p className="text-teal-400">No auction selected. Create or select one on the Auctions screen.</p>
        </RoleGate>
      </AppShell>
    )
  }

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))

  const save = async () => {
    setBusy(true); setMsg('')
    try {
      const payload = {
        name: form.name, season: form.season, sport: form.sport,
        auction_date: form.auction_date || null, auction_time: form.auction_time || null,
        squad_size: Number(form.squad_size || 0),
        default_team_budget: Number(form.default_team_budget || 0),
        default_base_price: Number(form.default_base_price || 0),
        min_player_price: Number(form.min_player_price || 0),
        initial_bid_timer_seconds: Number(form.initial_bid_timer_seconds || 90),
        bid_timer_seconds: Number(form.bid_timer_seconds || 15),
        reauction_refund_enabled: !!form.reauction_refund_enabled,
        banner_logo_url: form.banner_logo_url || null,
        sponsor_logos: form.sponsor_logos || []
      }
      await updateAuction(auction.id, payload)
      await reload()
      setMsg('Saved.')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onBanner = async (file) => {
    setUploadErr(''); setUploadingBanner(true)
    try {
      const url = await uploadBranding(file)
      set('banner_logo_url', url)
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
      set('sponsor_logos', [...(form.sponsor_logos || []), { name: file.name, url }])
    } catch (e) {
      setUploadErr(`Sponsor upload failed: ${e.message}`)
    } finally {
      setUploadingSponsor(false)
    }
  }

  const removeSponsor = (i) => set('sponsor_logos', form.sponsor_logos.filter((_, idx) => idx !== i))

  return (
    <AppShell title="Auction Setup">
      <RoleGate allow={['admin']}>
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Rules */}
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-3">
            <h3 className="font-score text-lg text-teal-200">Rules & details</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Name" value={form.name} onChange={(v) => set('name', v)} />
              <Field label="Season" value={form.season} onChange={(v) => set('season', v)} />
              <Field label="Sport" value={form.sport} onChange={(v) => set('sport', v)} />
              <Field label="Date" type="date" value={form.auction_date ?? ''} onChange={(v) => set('auction_date', v)} />
              <Field label="Time" type="time" value={form.auction_time ?? ''} onChange={(v) => set('auction_time', v)} />
              {NUMERIC.map(({ key, label }) => (
                <Field key={key} label={label} value={form[key] ?? ''}
                  onChange={(v) => set(key, Number(v.replace(/[^\d]/g, '') || 0))} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-teal-200">
              <input type="checkbox" checked={!!form.reauction_refund_enabled}
                onChange={(e) => set('reauction_refund_enabled', e.target.checked)} />
              Re-auction refund enabled
            </label>
            <button onClick={save} disabled={busy}
              className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <p className="text-xs text-teal-400">
              Initial timer applies when a player first appears. Each accepted bid then resets to the post-bid timer (default 15s).
            </p>
            {msg && <p className="text-teal-300 text-sm">{msg}</p>}
          </div>

          {/* Branding + quick links */}
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-3">
              <h3 className="font-score text-lg text-teal-200">Branding</h3>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-lg bg-ink-900 border border-teal-700/40 grid place-items-center overflow-hidden">
                  {form.banner_logo_url
                    ? <img src={form.banner_logo_url} alt="" className="h-full w-full object-cover" />
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
                  {(form.sponsor_logos || []).map((s, i) => (
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
                <p className="text-[0.65rem] text-teal-500 mt-1">Logo appears above — then click Save to persist.</p>
              </div>
            </div>

            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
              <h3 className="font-score text-lg text-teal-200 mb-2">Configure this auction</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['/teams', 'Teams'], ['/players', 'Players'],
                  ['/categories', 'Categories'], ['/queue', 'Queue'],
                  ['/users', 'Owners & Users'], ['/auction', 'Auction Centre']
                ].map(([to, label]) => (
                  <Link key={to} to={to} className="px-3 py-2 rounded-lg bg-ink-900 border border-teal-700/40 text-sm text-teal-200 hover:text-white text-center">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block text-xs text-teal-300 capitalize">
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white" />
    </label>
  )
}
