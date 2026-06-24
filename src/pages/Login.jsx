import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { verifyPublicCode } from '../lib/api'
import { supabase } from '../lib/supabase'
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
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetMsg, setResetMsg] = useState(null)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)

  const [showPublicForm, setShowPublicForm] = useState(needPublicCode)
  const [publicCode, setPublicCode] = useState('')
  const [publicErr, setPublicErr] = useState(null)
  const [publicBusy, setPublicBusy] = useState(false)

  const footerVersion = `v${String(packageMeta.version || '0.0.0').split('.').slice(0, 2).join('.')}`

  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('type=recovery')) return
    setIsRecoveryMode(true)
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Sign-in timed out. Check your connection and try again.')), 15000)
    )
    try {
      const { data, error } = await Promise.race([signIn(email, pw), timeout])
      if (error) {
        setErr(error.message)
      } else {
        const userId = data?.user?.id
        let role = 'public'
        if (userId) {
          const { data: p } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle()
          role = p?.role || 'public'
        }
        const target = location.state?.from?.pathname
          || (role === 'admin' ? '/auctions' : role === 'team_owner' ? '/team-bidding' : '/public-live')
        nav(target, { replace: true })
      }
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

  const sendResetLink = async (e) => {
    e.preventDefault()
    setResetBusy(true)
    setResetMsg(null)
    setErr(null)
    try {
      const appOrigin = import.meta.env.VITE_APP_ORIGIN || window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail || email, {
        redirectTo: `${appOrigin}/login`
      })
      if (error) throw error
      setResetMsg('Password reset email sent. Check your inbox and spam folder.')
    } catch (e) {
      setErr(e.message || 'Could not send reset email.')
    } finally {
      setResetBusy(false)
    }
  }

  const completeRecovery = async (e) => {
    e.preventDefault()
    setErr(null)
    setRecoveryBusy(true)
    try {
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters.')
      }
      if (newPassword !== confirmNewPassword) {
        throw new Error('Passwords do not match.')
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setResetMsg('Password updated. You can now sign in with your new password.')
      setIsRecoveryMode(false)
      window.history.replaceState({}, document.title, '/login')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (e) {
      setErr(e.message || 'Could not update password.')
    } finally {
      setRecoveryBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-sm space-y-4">
          {/* Main login card */}
          <div className="rounded-2xl bg-ink-800/80 border border-teal-700/50 shadow-card p-7">
            <div className="flex items-center gap-3 mb-1">
              <img src="/club-logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
              <h1 className="font-score text-4xl text-white leading-none">Auction</h1>
            </div>
            <p className="text-teal-400 text-sm mt-1 mb-6">South West Hitters · Player Auction</p>
            {isRecoveryMode ? (
              <form onSubmit={completeRecovery} className="space-y-3">
                <p className="text-sm text-teal-300">Set your new password</p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2.5 text-white"
                />
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2.5 text-white"
                />
                {err && <p className="text-live text-sm">{err}</p>}
                {resetMsg && <p className="text-teal-300 text-sm">{resetMsg}</p>}
                <button
                  disabled={recoveryBusy}
                  className="w-full rounded-lg bg-gold text-ink-900 font-semibold py-2.5 hover:bg-gold-soft disabled:opacity-50"
                >
                  {recoveryBusy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Email" autoComplete="username"
                  className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2.5 text-white" />
                <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                  placeholder="Password" autoComplete="current-password"
                  className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2.5 text-white" />
                {err && <p className="text-live text-sm">{err}</p>}
                {resetMsg && <p className="text-teal-300 text-sm">{resetMsg}</p>}
                <button disabled={busy}
                  className="w-full rounded-lg bg-gold text-ink-900 font-semibold py-2.5 hover:bg-gold-soft disabled:opacity-50">
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => { setShowReset((v) => !v); setResetMsg(null) }}
              className="mt-2 text-xs text-teal-300 hover:text-white transition"
            >
              {showReset ? 'Hide reset password' : 'Reset password'}
            </button>
            {showReset && (
              <form onSubmit={sendResetLink} className="mt-3 space-y-2 rounded-lg border border-teal-700/40 bg-ink-900/50 p-3">
                <p className="text-[0.7rem] uppercase tracking-wider text-teal-400">Password reset</p>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Email for reset link"
                  className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2 text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={resetBusy || !(resetEmail || email)}
                  className="w-full rounded-lg bg-teal-700 text-white font-semibold py-2 text-sm disabled:opacity-50"
                >
                  {resetBusy ? 'Sending…' : 'Send reset link'}
                </button>
                {resetMsg && <p className="text-xs text-teal-300">{resetMsg}</p>}
              </form>
            )}

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
