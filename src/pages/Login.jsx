import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)

    // Race the sign-in against a 15 s timeout so the button never freezes forever.
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

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-ink-800/80 border border-teal-700/50 shadow-card p-7">
        <div className="flex items-center gap-3 mb-1">
          <img src="/club-logo.png" alt="" className="h-10 w-10 rounded-lg object-cover" />
          <h1 className="font-score text-4xl text-white leading-none">Cricket Auction</h1>
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
        <button onClick={() => nav('/public-live')}
          className="w-full mt-3 text-teal-300 hover:text-white text-sm">
          Continue as public viewer →
        </button>
      </div>
    </div>
  )
}
