// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function extractPlayerUuid(url: string): string | null {
  const normalized = String(url || '').trim()
  if (!normalized) return null

  // Play Cricket (preferred):
  // https://play.cricket.com.au/player/{uuid}/name?tab=career
  const playCricket = normalized.match(/play\.cricket\.com\.au\/player\/([0-9a-f-]{36})/i)
  if (playCricket) return playCricket[1]

  // Legacy PlayHQ profile style (still accepted):
  // https://www.playhq.com/{region}/public/profile/{uuid}/statistics
  const playHq = normalized.match(/playhq\.com\/[^/]+\/(?:public\/)?profile\/([0-9a-f-]{36})/i)
  if (playHq) return playHq[1]

  return null
}

function inferRole(runs: number, wickets: number, matches: number): string {
  const m = matches || 1
  const rpm = runs / m
  const wpm = wickets / m
  if (rpm >= 10 && wpm >= 0.5) return 'All-Rounder'
  if (wpm >= 1 && rpm < 10) return 'Bowler'
  if (rpm > 10) return 'Batsman'
  if (wickets > 0) return 'All-Rounder'
  return 'Batsman'
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

  // Auth: admin only
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)
  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) return json({ error: 'Invalid session' }, 401)
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('user_id', caller.user.id).maybeSingle()
  if (callerProfile?.role !== 'admin') return json({ error: 'Admin role required' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const profileUrl = String(body.profile_url ?? '').trim()
  if (!profileUrl) return json({ error: 'profile_url is required' }, 400)

  const playerId = extractPlayerUuid(profileUrl)
  if (!playerId) {
    return json({
      error: 'Could not extract player UUID. Expected Play Cricket format: https://play.cricket.com.au/player/{uuid}/{name}?tab=career'
    }, 400)
  }

  try {
    const baseUrl = 'https://grassrootsapiproxy.cricket.com.au'

    const [playerRes, summaryRes] = await Promise.all([
      fetch(`${baseUrl}/participants/players/${playerId}?responseModifier=includeOrganisations&jsconfig=eccn:true`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json'
        }
      }),
      fetch(`${baseUrl}/participants/players/${playerId}/summary-statistics?jsconfig=eccn:true`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json'
        }
      })
    ])

    if (!playerRes.ok) {
      return json({ error: `Play Cricket player lookup failed (HTTP ${playerRes.status})` }, 502)
    }
    if (!summaryRes.ok) {
      return json({ error: `Play Cricket statistics lookup failed (HTTP ${summaryRes.status})` }, 502)
    }

    const player = await playerRes.json()
    const summary = await summaryRes.json()

    const name = String(player?.name ?? '').trim() || null
    const matches = num(summary?.matches)
    const runs = num(summary?.battingAggregate)
    const wickets = num(summary?.bowlingWickets)

    const battingStyle = null
    const bowlingStyle = null

    return json({
      ok: true,
      source: 'play-cricket',
      name,
      matches,
      runs,
      bat_avg: num(summary?.battingAverage),
      strike_rate: num(summary?.battingStrikeRate),
      fifties: num(summary?.batting50s),
      hundreds: num(summary?.batting100s),
      sixes: num(summary?.battingSixes),
      wickets,
      economy: num(summary?.bowlingEconomyRate),
      bowl_avg: num(summary?.bowlingAverage),
      dot_balls: num(summary?.bowlingDotBalls),
      three_wicket_hauls: num(summary?.bowling3WIs),
      five_wicket_hauls: num(summary?.bowling5WIs),
      catches: num(summary?.fieldingTotalCatches),
      run_outs: num(summary?.fieldingRunOuts),
      stumpings: num(summary?.fieldingStumpings),
      batting_style: battingStyle,
      bowling_style: bowlingStyle,
      role: inferRole(runs, wickets, matches || 1),
      photo_url: String(player?.photoUrl ?? player?.profilePictureUrl ?? '') || null
    })
  } catch (e) {
    return json({ error: `Failed to fetch from Play Cricket: ${e.message}` }, 502)
  }
})
