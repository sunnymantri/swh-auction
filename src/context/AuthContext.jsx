import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load (or lazily create) the profile row that drives RLS + role.
  async function loadProfile(user) {
    if (!user) { setProfile(null); return }
    let { data } = await supabase
      .from('profiles').select('*').eq('user_id', user.id).maybeSingle()
    if (!data) {
      const ins = await supabase.from('profiles')
        .insert({ user_id: user.id, full_name: user.email, role: 'public' })
        .select().single()
      data = ins.data
    }
    setProfile(data)
  }

  useEffect(() => {
    let mounted = true

    // Hard-timeout fallback: if Supabase hasn't resolved in 8 s (e.g. the
    // project is paused or the network is unreachable), unblock the UI so
    // the user lands on the public view instead of a permanent spinner.
    const giveUp = setTimeout(() => {
      console.warn('[AuthContext] session check timed out – treating as signed out')
      if (mounted) setLoading(false)
    }, 8000)

    // Path 1: initial load — getSession() reads from localStorage immediately
    // when the JWT is still valid (sub-100ms, no network). When expired it
    // awaits a token refresh; .finally() always calls setLoading(false).
    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!mounted) return
        setSession(data.session)
        try { await loadProfile(data.session?.user) }
        catch (err) { console.error('[AuthContext] loadProfile', err); setProfile(null) }
      })
      .catch((err) => console.error('[AuthContext] getSession', err))
      .finally(() => { clearTimeout(giveUp); if (mounted) setLoading(false) })

    // Path 2: subsequent changes only (sign in, sign out, token refresh).
    // Does NOT touch loading — Path 1 owns that gate.
    //
    // IMPORTANT: the callback must NOT be async / must NOT await another
    // Supabase call directly. On a page refresh with a stored session,
    // supabase-js holds an internal auth lock while it validates/refreshes
    // the token and fires this event; awaiting a DB query here (loadProfile)
    // deadlocks against that lock and hangs every other query (e.g. the
    // auction list) — the "stuck on Loading…" bug. Defer with setTimeout(0)
    // so the lock is released before loadProfile runs.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
      setTimeout(() => {
        if (!mounted) return
        loadProfile(s?.user).catch((err) => {
          console.error('[AuthContext] loadProfile', err); setProfile(null)
        })
      }, 0)
    })

    return () => { mounted = false; clearTimeout(giveUp); sub.subscription.unsubscribe() }
  }, [])

  async function signOutSafe() {
    // Make sign-out UX deterministic even if network/Supabase is slow.
    setSession(null)
    setProfile(null)
    try {
      // Local scope clears browser session/tokens immediately (no network wait).
      await supabase.auth.signOut({ scope: 'local' })
      // Optional best-effort global sign-out in background.
      await Promise.race([
        supabase.auth.signOut({ scope: 'global' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), 5000))
      ])
    } catch (err) {
      // Session is already cleared locally; log remote failures for debugging.
      console.warn('[AuthContext] signOut fallback:', err?.message || err)
    }
  }

  async function refreshProfile() {
    await loadProfile(session?.user ?? null)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? 'public',
    isAdmin: profile?.role === 'admin',
    isTeamOwner: profile?.role === 'team_owner',
    loading,
    refreshProfile,
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signOut: signOutSafe
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
