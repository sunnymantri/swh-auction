// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function extractPlayerId(url: string): string | null {
  const match = url.match(/player-profile\/(\d+)/)
  return match?.[1] ?? null
}

function parsePlayerStatement(statement: string) {
  const stats: Record<string, number> = {}
  const clean = statement.replace(/<[^>]+>/g, '')
  const avgMatch = clean.match(/average of\s*([\d.]+)/i)
  if (avgMatch) stats.bat_avg = parseFloat(avgMatch[1])
  const bowlAvgMatch = clean.match(/bowling average of\s*([\d.]+)/i)
  if (bowlAvgMatch) stats.bowl_avg = parseFloat(bowlAvgMatch[1])
  const bowlAvgAltMatch = clean.match(/average of\s*([\d.]+)\s*(?:while|in)\s*bowling/i)
  if (!stats.bowl_avg && bowlAvgAltMatch) stats.bowl_avg = parseFloat(bowlAvgAltMatch[1])
  const srMatch = clean.match(/strike rate of\s*([\d.]+)/i)
  if (srMatch) stats.strike_rate = parseFloat(srMatch[1])
  const econMatch = clean.match(/economy rate of\s*([\d.]+)/i)
  if (econMatch) stats.economy = parseFloat(econMatch[1])
  const econAltMatch = clean.match(/economy(?: rate)? of\s*([\d.]+)/i)
  if (!stats.economy && econAltMatch) stats.economy = parseFloat(econAltMatch[1])
  const wicketsMatch = clean.match(/taking\s*(\d+)\s*wickets/i)
  if (wicketsMatch) stats.wickets = parseInt(wicketsMatch[1])
  const topScoreMatch = clean.match(/top score of\s*(\d+)/i)
  if (topScoreMatch) stats.top_score = parseInt(topScoreMatch[1])
  const sixesMatch = clean.match(/(\d+)\s*sixes/i)
  if (sixesMatch) stats.sixes = parseInt(sixesMatch[1])
  const foursMatch = clean.match(/(\d+)\s*fours/i)
  if (foursMatch) stats.fours = parseInt(foursMatch[1])
  return stats
}

function inferRole(player: Record<string, unknown>, statementStats: Record<string, number>): string {
  if (player.playing_role) return String(player.playing_role)

  const matches = Number(player.total_matches) || 1
  const runs = Number(player.total_runs) || 0
  const wickets = Number(player.total_wickets) || 0

  const runsPerMatch = runs / matches
  const wicketsPerMatch = wickets / matches

  const hasBowlingStyle = !!player.bowling_style
  const isBatsman = runsPerMatch > 15 && wicketsPerMatch < 0.5
  const isBowler = wicketsPerMatch >= 1 && runsPerMatch < 10
  const isAllRounder = runsPerMatch >= 10 && wicketsPerMatch >= 0.5 && hasBowlingStyle

  if (isAllRounder) return 'All-Rounder'
  if (isBowler) return 'Bowler'
  if (isBatsman) return 'Batsman'
  if (hasBowlingStyle && wickets > 0) return 'All-Rounder'
  return 'Batsman'
}

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '')
    const direct = Number(cleaned)
    if (Number.isFinite(direct)) return direct
    const firstNumeric = cleaned.match(/-?\d+(?:\.\d+)?/)
    if (firstNumeric) {
      const extracted = Number(firstNumeric[0])
      if (Number.isFinite(extracted)) return extracted
    }
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function deepFindFirstNumber(source: unknown, candidateKeys: string[]): number | null {
  if (!source || typeof source !== 'object') return null
  const wanted = new Set(candidateKeys.map(normalizeKey))
  const stack: unknown[] = [source]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item)
      continue
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (wanted.has(normalizeKey(key))) {
        const n = toNumber(value)
        if (n != null) return n
      }
      if (value && typeof value === 'object') stack.push(value)
    }
  }
  return null
}

// Pull the per-discipline statistics tab the cricheroes.com Stats page uses.
// Shape: { data: { statistics: { batting: [{title, value}], bowling: [...], fielding: [...] } } }
// Returns label-keyed maps, or null on any failure (caller falls back to summary-only).
// TEMP debug bucket so the caller can attach diagnosis info to the API response.
const detailDebug: Record<string, unknown> = {}

async function fetchDetailStats(
  playerId: string,
  apiKey: string
): Promise<{ batting: Map<string, unknown>, bowling: Map<string, unknown>, fielding: Map<string, unknown> } | null> {
  const url = `https://api.cricheroes.in/api/v1/player/get-player-statistic/${playerId}?pagesize=12`
  detailDebug.url = url
  try {
    const res = await fetch(url, {
      headers: {
        'api-key': apiKey,
        'device-type': 'Chrome: 120.0.0.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-AU,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://cricheroes.com',
        'Referer': 'https://cricheroes.com/'
      }
    })
    detailDebug.httpStatus = res.status
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      detailDebug.bodySnippet = body.slice(0, 400)
      console.error('[fetch-cricheroes] detail endpoint non-OK', res.status, body.slice(0, 400))
      return null
    }
    const data = await res.json()
    detailDebug.payloadStatus = data?.status
    detailDebug.payloadKeys = data && typeof data === 'object' ? Object.keys(data) : null
    if (data?.status !== true) {
      detailDebug.errorMessage = data?.error?.message ?? data?.message ?? null
      console.error('[fetch-cricheroes] detail status:false', JSON.stringify(data).slice(0, 400))
      return null
    }
    const stats = data?.data?.statistics
    if (!stats) {
      detailDebug.dataKeys = data?.data && typeof data.data === 'object' ? Object.keys(data.data) : null
      console.error('[fetch-cricheroes] detail missing statistics', JSON.stringify(data?.data).slice(0, 400))
      return null
    }

    const toLabelMap = (arr: unknown): Map<string, unknown> => {
      const m = new Map<string, unknown>()
      if (!Array.isArray(arr)) return m
      for (const item of arr) {
        const title = (item as Record<string, unknown>)?.title
        if (typeof title === 'string') {
          m.set(title.toLowerCase().trim(), (item as Record<string, unknown>).value)
        }
      }
      return m
    }
    const batting = toLabelMap(stats.batting)
    const bowling = toLabelMap(stats.bowling)
    const fielding = toLabelMap(stats.fielding)
    detailDebug.labelCounts = { batting: batting.size, bowling: bowling.size, fielding: fielding.size }
    detailDebug.fieldingTitles = Array.from(fielding.keys())
    return { batting, bowling, fielding }
  } catch (e) {
    detailDebug.exception = String(e)
    console.error('[fetch-cricheroes] detail endpoint threw', e)
    return null
  }
}

function deepFindByLabelValue(source: unknown, labels: string[]): number | null {
  if (!source || typeof source !== 'object') return null
  const wanted = labels.map((l) => l.toLowerCase())
  const stack: unknown[] = [source]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item)
      continue
    }
    const obj = node as Record<string, unknown>
    const labelRaw =
      obj.label ?? obj.title ?? obj.name ?? obj.metric ?? obj.key ?? null
    const valueRaw =
      obj.value ?? obj.count ?? obj.total ?? obj.stat ?? obj.stats ?? null

    if (typeof labelRaw === 'string') {
      const label = labelRaw.toLowerCase().trim()
      if (wanted.some((w) => label.includes(w))) {
        const n = toNumber(valueRaw)
        if (n != null) return n
      }
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') stack.push(value)
    }
  }
  return null
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

  const playerId = extractPlayerId(profileUrl)
  if (!playerId) return json({ error: 'Could not extract player ID from URL' }, 400)

  try {
    const cricHeroesApiKey = Deno.env.get('CRICHEROES_API_KEY') ?? ''
    if (!cricHeroesApiKey) return json({ error: 'Server missing CRICHEROES_API_KEY' }, 500)

    const res = await fetch(
      `https://cricheroes.in/api/v1/player/get-player-profile-web/${playerId}`,
      {
        headers: {
          'api-key': cricHeroesApiKey,
          'device-type': 'Chrome: 120.0.0.0',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://cricheroes.com',
          'Referer': 'https://cricheroes.com/'
        }
      }
    )

    if (!res.ok) {
      return json({ error: `CricHeroes API returned ${res.status}` }, 502)
    }

    const data = await res.json()

    if (data?.status === false) {
      return json({ error: data?.error?.message || 'CricHeroes API error' }, 502)
    }

    const player = data?.data
    if (!player) return json({ error: 'No player data returned' }, 404)

    const statementStats = parsePlayerStatement(player.player_statement || '')
    const role = inferRole(player, statementStats)

    // Per-discipline detail stats (catches, run_outs, stumpings, bowl_avg, etc.)
    // live on a separate endpoint that the cricheroes.com Stats tab calls.
    const detail = await fetchDetailStats(playerId, cricHeroesApiKey)
    const bat = detail?.batting
    const bowl = detail?.bowling
    const field = detail?.fielding

    // Fallback scans against the summary payload, used only when the detail
    // endpoint is unavailable (network failure, key revoked, shape change).
    const catchesFallback = deepFindFirstNumber(player, ['total_catches', 'catches', 'catch'])
      ?? deepFindByLabelValue(player, ['catches', 'catch'])
    const runOutsFallback = deepFindFirstNumber(player, ['run_outs', 'runouts', 'run_out', 'runout'])
      ?? deepFindByLabelValue(player, ['run out', 'run-outs', 'runouts'])
    const stumpingsFallback = deepFindFirstNumber(player, ['stumpings', 'stumping'])
      ?? deepFindByLabelValue(player, ['stumpings', 'stumping'])
    const bowlAvgFallback = statementStats.bowl_avg
      ?? deepFindFirstNumber(player, ['bowl_avg', 'bowling_average', 'average_bowling'])
      ?? deepFindByLabelValue(player, ['bowling average', 'avg'])
    const economyFallback = statementStats.economy
      ?? deepFindFirstNumber(player, ['economy', 'economy_rate', 'econ'])
      ?? deepFindByLabelValue(player, ['economy'])

    // Fields the summary endpoint reliably populates (matches/runs/wickets) keep
    // numeric defaults. Everything else returns null when truly absent so the
    // frontend merger's `?? player.x` / `!= null` checks preserve existing values
    // instead of overwriting them with 0.
    const result = {
      name: player.name || null,
      matches: toNumber(bat?.get('matches')) ?? player.total_matches ?? 0,
      runs: toNumber(bat?.get('runs')) ?? player.total_runs ?? 0,
      wickets: toNumber(bowl?.get('wickets')) ?? statementStats.wickets ?? player.total_wickets ?? 0,
      batting_style: player.batting_hand === 'RHB' ? 'Right-hand bat' :
                     player.batting_hand === 'LHB' ? 'Left-hand bat' : player.batting_hand || null,
      bowling_style: player.bowling_style || null,
      role,
      bat_avg: toNumber(bat?.get('avg')) ?? statementStats.bat_avg ?? null,
      strike_rate: toNumber(bat?.get('sr')) ?? statementStats.strike_rate ?? null,
      bowl_avg: toNumber(bowl?.get('avg')) ?? bowlAvgFallback ?? null,
      economy: toNumber(bowl?.get('economy')) ?? economyFallback ?? null,
      catches: toNumber(field?.get('catches')) ?? catchesFallback ?? null,
      run_outs: toNumber(field?.get('run outs')) ?? runOutsFallback ?? null,
      stumpings: toNumber(field?.get('stumpings')) ?? stumpingsFallback ?? null,
      fifties: toNumber(bat?.get('50s')) ?? null,
      hundreds: toNumber(bat?.get('100s')) ?? null,
      sixes: toNumber(bat?.get('6s')) ?? null,
      dot_balls: toNumber(bowl?.get('dot balls')) ?? null,
      three_wicket_hauls: toNumber(bowl?.get('3 wickets')) ?? null,
      five_wicket_hauls: toNumber(bowl?.get('5 wickets')) ?? null,
      photo_url: player.profile_photo || null
    }

    return json({ ok: true, ...result, _detailDebug: detailDebug })
  } catch (e) {
    return json({ error: `Failed to fetch from CricHeroes: ${e.message}` }, 502)
  }
})
