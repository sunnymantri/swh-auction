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

// ---- Password reset via the admin-reset-password Edge Function ----
// Returns { ok, password } with a newly generated random password.
export async function resetUserPassword(profileId) {
  const { data, error } = await supabase.functions.invoke('admin-reset-password', {
    body: { profile_id: profileId }
  })
  if (error) {
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

export async function notifyOwnerCredentials({
  email,
  teamName,
  password,
  includeEmail = true,
  includeSms = false,
  phone = '',
  appUrl = ''
}) {
  const { data, error } = await supabase.functions.invoke('admin-notify-owner', {
    body: {
      email,
      team_name: teamName,
      password,
      include_email: !!includeEmail,
      include_sms: !!includeSms,
      phone: phone || null,
      app_url: appUrl || null
    }
  })
  if (error) {
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
