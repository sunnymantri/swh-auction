import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type NotifyPayload = {
  email: string
  team_name?: string
  password?: string
  include_email?: boolean
  include_sms?: boolean
  phone?: string | null
  app_url?: string | null
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

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) return json({ error: 'Invalid session' }, 401)

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', caller.user.id)
    .maybeSingle()
  if (callerProfile?.role !== 'admin') return json({ error: 'Admin role required' }, 403)

  let body: NotifyPayload
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const email = String(body.email ?? '').trim().toLowerCase()
  const teamName = String(body.team_name ?? 'your team').trim() || 'your team'
  const password = String(body.password ?? '').trim()
  const includeEmail = body.include_email !== false
  const includeSms = body.include_sms === true
  const phone = String(body.phone ?? '').trim()
  const appUrl = String(body.app_url ?? '').trim() || Deno.env.get('APP_URL') || Deno.env.get('APP_ORIGIN') || ''

  if (!email) return json({ error: 'email is required' }, 400)
  if (!password) return json({ error: 'password is required' }, 400)
  if (!includeEmail && !includeSms) return json({ error: 'No notification channel selected' }, 400)
  if (includeSms && !phone) return json({ error: 'phone is required for SMS notifications' }, 400)

  const lines = [
    `Your team owner login has been updated for ${teamName}.`,
    `Email: ${email}`,
    `Password: ${password}`,
    appUrl ? `Login: ${appUrl}` : null,
    'Please change your password after first login.'
  ].filter(Boolean)
  const messageText = lines.join('\n')

  const sent: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  if (includeEmail) {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('NOTIFY_FROM_EMAIL')
    if (resendKey && fromEmail) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `Updated login details for ${teamName}`,
          text: messageText
        })
      })
      if (emailRes.ok) sent.push('email')
      else errors.push(`Email send failed (${emailRes.status})`)
    } else {
      skipped.push('email')
    }
  }

  if (includeSms) {
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioFrom = Deno.env.get('TWILIO_FROM_NUMBER')
    if (twilioSid && twilioToken && twilioFrom) {
      const form = new URLSearchParams({
        To: phone,
        From: twilioFrom,
        Body: messageText
      })
      const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      })
      if (smsRes.ok) sent.push('sms')
      else errors.push(`SMS send failed (${smsRes.status})`)
    } else {
      skipped.push('sms')
    }
  }

  const warningParts = []
  if (skipped.length) warningParts.push(`Skipped: ${skipped.join(', ')} (missing provider secrets).`)
  if (errors.length) warningParts.push(errors.join(' '))

  return json({
    ok: errors.length === 0,
    sent,
    skipped,
    warning: warningParts.length ? warningParts.join(' ') : null
  }, errors.length ? 502 : 200)
})
