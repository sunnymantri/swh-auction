import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { verifyPublicCode } from '../lib/api'
import { setPublicAuthGranted } from '../components/common/RequirePublicAuth'
import packageMeta from '../../package.json'

export default function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const needPublicCode = location.state?.needPublicCode ?? false

  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const [showPublicForm, setShowPublicForm] = useState(needPublicCode)
  const [publicCode, setPublicCode] = useState('')
  const [publicErr, setPublicErr] = useState(null)
  const [publicBusy, setPublicBusy] = useState(false)

  const footerVersion = `v${String(packageMeta.version || '0.0.0').split('.').slice(0, 2).join('.')}`

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Sign-in timed out. Check your connection and try again.')), 15000)
    )
    try {
      const { error } = await Promise.race([signIn(email, pw), timeout])
      if (error) setErr(error.message)
      else nav(location.state?.from?.pathname || '/', { replace: true })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const enterPublicView = async (e) => {
    e.preventDefault()
    setPublicBusy(true); setPublicErr(null)
    try {
      const ok = await verifyPublicCode(publicCode)
      if (!ok) {
        setPublicErr('Incorrect access code. Please check with the auction administrator.')
        return
      }
      setPublicAuthGranted()
      nav('/public-live', { replace: true })
    } catch (e) {
      setPublicErr(e.message || 'Could not verify code. Please try again.')
    } finally {
      setPublicBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-sm space-y-4">
          {/* Main login card */}
          <div className="rounded-2xl bg-ink-800/80 border border-teal-700/50 shadow-card p-7">
            <div className="flex items-center gap-3 mb-1">
              <img src="/club-logo.png" alt="" className="h-10 w-10 rounded-lg object-cover" />
              <h1 className="font-score text-4xl text-white leading-none">Auction</h1>
            </div>
            <p className="text-teal-400 text-sm mt-1 mb-6">South West Hitters · Player Auction</p>
            <form onSubmit={submit} className="space-y-3">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email" autoComplete="username"
                className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2.5 text-white" />
              <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                placeholder="Password" autoComplete="current-password"
                className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2.5 text-white" />
              {err && <p className="text-live text-sm">{err}</p>}
              <button disabled={busy}
                className="w-full rounded-lg bg-gold text-ink-900 font-semibold py-2.5 hover:bg-gold-soft disabled:opacity-50">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-4 border-t border-teal-700/30 pt-4">
              {!showPublicForm ? (
                <button onClick={() => setShowPublicForm(true)}
                  className="w-full text-teal-300 hover:text-white text-sm transition">
                  Continue as public viewer →
                </button>
              ) : (
                <form onSubmit={enterPublicView} className="space-y-3">
                  <p className="text-xs text-teal-400 font-medium uppercase tracking-wider">Public viewer access</p>
                  <input
                    type="text"
                    value={publicCode}
                    onChange={e => setPublicCode(e.target.value)}
                    placeholder="Enter access code"
                    autoFocus
                    className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2.5 text-white tracking-widest"
                  />
                  {publicErr && <p className="text-live text-xs">{publicErr}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={publicBusy}
                      className="flex-1 rounded-lg bg-teal-700 text-white font-semibold py-2 hover:bg-teal-600 disabled:opacity-50 text-sm">
                      {publicBusy ? 'Checking…' : 'Enter'}
                    </button>
                    <button type="button" onClick={() => { setShowPublicForm(false); setPublicErr(null); setPublicCode('') }}
                      className="px-4 rounded-lg border border-teal-700/40 text-teal-400 hover:text-white text-sm transition">
                      Back
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer — matches the app-wide footer */}
      <footer className="border-t border-teal-700/30 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1">
          <p className="text-xs text-teal-500">
            {footerVersion} · Developed by Sunny Mantri for South West Hitters Cricket Club
          </p>
          <p className="text-[0.7rem] text-teal-600">ABN 56 495 977 829</p>
        </div>
      </footer>
    </div>
  )
}
