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
import { corsHeaders } from '../_shared/cors.ts'

function randomPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
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
  const isBidder = body.is_bidder === true
  const password = body.password ? String(body.password) : randomPassword()

  if (!email) return json({ error: 'Email is required' }, 400)

  // Validate team linkage up-front so we do not create orphaned auth users.
  if (teamId && role === 'team_owner') {
    const { data: team, error: teamErr } = await admin
      .from('teams')
      .select('id, owner_user_id')
      .eq('id', teamId)
      .maybeSingle()
    if (teamErr) return json({ error: teamErr.message }, 400)
    if (!team) return json({ error: 'Selected team not found' }, 400)
  }

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
    .upsert({
      user_id: created.user.id,
      full_name: fullName,
      role,
      team_id: role === 'team_owner' ? teamId : null
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (profileErr) return json({ error: profileErr.message }, 400)

  // 5) Optionally designate bidder for the selected team.
  if (teamId && role === 'team_owner' && isBidder) {
    const { data: currentBidderTeam } = await admin
      .from('teams')
      .select('owner_user_id')
      .eq('id', teamId)
      .maybeSingle()

    if (currentBidderTeam?.owner_user_id && currentBidderTeam.owner_user_id !== profile.id) {
      const { error: clearErr } = await admin
        .from('teams').update({ owner_user_id: null }).eq('id', teamId)
      if (clearErr) return json({ error: clearErr.message }, 400)
    }

    const { error: linkErr } = await admin
      .from('teams').update({ owner_user_id: profile.id, owner_email: email }).eq('id', teamId)
    if (linkErr) return json({ error: linkErr.message }, 400)
  }

  return json({ ok: true, email, password, role, profile_id: profile.id })
})
