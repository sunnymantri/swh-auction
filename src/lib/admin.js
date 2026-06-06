import { supabase } from './supabase'

// ---- Profiles / roles ----
export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setProfileRole(profileId, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- Account creation via the admin-create-user Edge Function ----
// Returns { ok, email, password, role, profile_id } so the admin can share
// the generated credentials with the new team owner.
export async function createUserAccount({ email, fullName, role = 'team_owner', teamId = null, password = null }) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: { email, full_name: fullName, role, team_id: teamId, password }
  })
  if (error) {
    // Edge Functions return error detail in the response body when non-2xx.
    let detail = error.message
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) detail = ctx.error
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
