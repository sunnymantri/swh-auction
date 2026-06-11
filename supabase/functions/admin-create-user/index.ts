// =====================================================================
//  Edge Function: admin-create-user
//  Creates an auth user + profile for a team owner (or another admin),
//  optionally linking them to a team. Must be called by an admin.
//
//  Deploy:  supabase functions deploy admin-create-user
//  Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the
//           platform; no extra secrets needed.
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? Deno.env.get('VITE_APP_ORIGIN') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function randomPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  // Admin client (service role) — bypasses RLS.
  const admin = createClient(supabaseUrl, serviceKey)

  // 1) Verify the caller and that they are an admin.
  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) return json({ error: 'Invalid session' }, 401)

  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('user_id', caller.user.id).maybeSingle()
  if (callerProfile?.role !== 'admin') return json({ error: 'Admin role required' }, 403)

  // 2) Parse input.
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = body.full_name ? String(body.full_name) : email
  const role = (body.role === 'admin' || body.role === 'team_owner') ? body.role : 'team_owner'
  const teamId = body.team_id ? String(body.team_id) : null
  const password = body.password ? String(body.password) : randomPassword()

  if (!email) return json({ error: 'Email is required' }, 400)

  // 3) Create the auth user (email pre-confirmed for demo simplicity).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })
  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? 'Could not create user' }, 400)
  }

  // 4) Upsert the profile with the chosen role.
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .upsert({ user_id: created.user.id, full_name: fullName, role }, { onConflict: 'user_id' })
    .select()
    .single()
  if (profileErr) return json({ error: profileErr.message }, 400)

  // 5) Optionally link the new owner to a team.
  if (teamId && role === 'team_owner') {
    const { error: linkErr } = await admin
      .from('teams').update({ owner_user_id: profile.id, owner_email: email }).eq('id', teamId)
    if (linkErr) return json({ error: linkErr.message }, 400)
  }

  return json({ ok: true, email, password, role, profile_id: profile.id })
})
