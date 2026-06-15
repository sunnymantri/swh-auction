import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) return json({ error: 'Invalid session' }, 401)

  const { data: callerProfile } = await admin
    .from('profiles').select('id, role').eq('user_id', caller.user.id).maybeSingle()
  if (callerProfile?.role !== 'admin') return json({ error: 'Admin role required' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const profileId = body.profile_id ? String(body.profile_id) : null
  if (!profileId) return json({ error: 'profile_id is required' }, 400)
  if (callerProfile?.id === profileId) return json({ error: 'You cannot delete your own user from here' }, 400)

  const { data: profile } = await admin
    .from('profiles').select('id, user_id').eq('id', profileId).maybeSingle()
  if (!profile?.user_id) return json({ error: 'Profile not found' }, 404)

  // Unlink this profile from any team owner mapping first.
  const { error: unlinkErr } = await admin
    .from('teams')
    .update({ owner_user_id: null })
    .eq('owner_user_id', profileId)
  if (unlinkErr) return json({ error: unlinkErr.message }, 400)

  const { error: profileDeleteErr } = await admin.from('profiles').delete().eq('id', profileId)
  if (profileDeleteErr) return json({ error: profileDeleteErr.message }, 400)

  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(profile.user_id)
  if (authDeleteErr) return json({ error: authDeleteErr.message }, 400)

  return json({ ok: true })
})
