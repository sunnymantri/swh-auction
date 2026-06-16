// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function extractUuidAndRegion(url: string): { uuid: string | null; region: string } {
  // e.g. https://www.playhq.com/uk/public/profile/dd998658-43fa-489c-a0bd-93fafcc0ca84/statistics
  const match = url.match(/playhq\.com\/([^/]+)\/(?:public\/)?profile\/([0-9a-f-]{36})/i)
  if (!match) return { uuid: null, region: 'aus' }
  return { uuid: match[2], region: match[1] }
}

function extractNextData(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

// Walk a nested object returning the first value found at any of the given paths
function dig(obj: unknown, ...paths: string[][]): unknown {
  for (const path of paths) {
    let cur: unknown = obj
    for (const key of path) {
      if (cur == null || typeof cur !== 'object') { cur = undefined; break }
      cur = (cur as Record<string, unknown>)[key]
    }
    if (cur !== undefined && cur !== null) return cur
  }
  return undefined
}

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function inferRole(runs: number, wickets: number, matches: number, bowlingStyle: string | null): string {
  const m = matches || 1
  const rpm = runs / m
  const wpm = wickets / m
  if (rpm >= 10 && wpm >= 0.5 && bowlingStyle) return 'All-Rounder'
  if (wpm >= 1 && rpm < 10) return 'Bowler'
  if (rpm > 10) return 'Batsman'
  if (wickets > 0 && bowlingStyle) return 'All-Rounder'
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

  const { uuid, region } = extractUuidAndRegion(profileUrl)
  if (!uuid) return json({ error: 'Could not extract player UUID from PlayHQ URL. Expected format: https://www.playhq.com/{region}/public/profile/{uuid}/statistics' }, 400)

  // Build the canonical statistics page URL
  const pageUrl = `https://www.playhq.com/${region}/public/profile/${uuid}/statistics`

  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      }
    })

    if (!res.ok) {
      return json({ error: `PlayHQ returned HTTP ${res.status} for ${pageUrl}` }, 502)
    }

    const html = await res.text()
    const nextData = extractNextData(html)

    if (!nextData) {
      const snippet = html.slice(0, 3000)
      const scriptTags = [...html.matchAll(/<script[^>]*>/gi)].map(m => m[0]).slice(0, 10)
      const debugInfo = {
        html_length: html.length,
        has_next_data: html.includes('__NEXT_DATA__'),
        has_nuxt: html.includes('__NUXT__'),
        has_apollo: html.includes('apollo'),
        has_graphql: html.includes('graphql'),
        script_tags: scriptTags,
        html_snippet: snippet,
      }
      // Log to Supabase function logs so it's visible in the dashboard
      console.log('PlayHQ debug:', JSON.stringify(debugInfo))
      return json({
        error: 'Could not find __NEXT_DATA__ on the PlayHQ page.',
        ...debugInfo,
      }, 502)
    }

    // PlayHQ Next.js page — try several known path patterns for participant data
    const pageProps = dig(nextData, ['props', 'pageProps']) as Record<string, unknown> ?? {}

    // Participant identity — try multiple field names used across PlayHQ regions
    const participant = (
      dig(pageProps, ['participant'], ['player'], ['profile'], ['data', 'participant'], ['data', 'player'])
    ) as Record<string, unknown> | undefined

    if (!participant) {
      return json({
        error: 'Could not locate participant data in PlayHQ response. Keys found: ' + Object.keys(pageProps).join(', '),
        debug_keys: Object.keys(pageProps),
      }, 502)
    }

    // Name
    const name = String(
      dig(participant, ['name'], ['fullName'], ['displayName'], ['firstName']) ?? ''
    ) || null

    // Photo
    const photoUrl = String(
      dig(participant, ['avatarUrl'], ['photoUrl'], ['profilePhoto'], ['image', 'url'], ['avatar', 'url']) ?? ''
    ) || null

    // Batting / bowling hand
    const battingHandRaw = String(
      dig(participant, ['battingHand'], ['batting_hand'], ['bat_hand'], ['battingStyle']) ?? ''
    )
    const battingStyle = battingHandRaw.match(/left/i) ? 'Left-hand bat'
      : battingHandRaw.match(/right/i) ? 'Right-hand bat'
      : battingHandRaw || null

    const bowlingStyle = String(
      dig(participant, ['bowlingStyle'], ['bowling_style'], ['bowlStyle']) ?? ''
    ) || null

    // Statistics block — PlayHQ may nest under participant.statistics or pageProps.statistics
    const statsBlock = (
      dig(participant, ['statistics'], ['stats'], ['seasonStatistics'], ['careerStatistics'])
      ?? dig(pageProps, ['statistics', 'career'], ['statistics'], ['stats'])
    ) as Record<string, unknown> | undefined ?? {}

    // Batting stats
    const bat = (
      dig(statsBlock, ['batting'], ['bat'], ['battingStatistics'])
    ) as Record<string, unknown> | undefined ?? {}

    const matches   = num(dig(bat, ['matchesPlayed'], ['matches'], ['innings']))
    const runs      = num(dig(bat, ['runsScored'], ['runs'], ['totalRuns']))
    const batAvg    = num(dig(bat, ['average'], ['battingAverage'], ['avg']))
    const strikeRate = num(dig(bat, ['strikeRate'], ['battingStrikeRate'], ['strike_rate']))
    const fifties   = num(dig(bat, ['fifties'], ['halfCenturies'], ['50s']))
    const hundreds  = num(dig(bat, ['hundreds'], ['centuries'], ['100s']))
    const sixes     = num(dig(bat, ['sixes'], ['sixesHit']))

    // Bowling stats
    const bowl = (
      dig(statsBlock, ['bowling'], ['bowl'], ['bowlingStatistics'])
    ) as Record<string, unknown> | undefined ?? {}

    const wickets   = num(dig(bowl, ['wickets'], ['totalWickets'], ['wicketsTaken']))
    const economy   = num(dig(bowl, ['economy'], ['economyRate'], ['econ']))
    const bowlAvg   = num(dig(bowl, ['average'], ['bowlingAverage'], ['avg']))
    const dotBalls  = num(dig(bowl, ['dotBalls'], ['dots']))
    const threeWkt  = num(dig(bowl, ['threeWicketHauls'], ['three_fers'], ['3wkt']))
    const fiveWkt   = num(dig(bowl, ['fiveWicketHauls'], ['five_fers'], ['5wkt']))

    // Fielding stats
    const field = (
      dig(statsBlock, ['fielding'], ['field'], ['fieldingStatistics'])
    ) as Record<string, unknown> | undefined ?? {}

    const catches   = num(dig(field, ['catches'], ['catchesTaken']))
    const runOuts   = num(dig(field, ['runOuts'], ['run_outs']))
    const stumpings = num(dig(field, ['stumpings']))

    const role = inferRole(runs, wickets, matches || 1, bowlingStyle)

    return json({
      ok: true,
      name,
      matches,
      runs,
      bat_avg: batAvg,
      strike_rate: strikeRate,
      fifties,
      hundreds,
      sixes,
      wickets,
      economy,
      bowl_avg: bowlAvg,
      dot_balls: dotBalls,
      three_wicket_hauls: threeWkt,
      five_wicket_hauls: fiveWkt,
      catches,
      run_outs: runOuts,
      stumpings,
      batting_style: battingStyle,
      bowling_style: bowlingStyle,
      role,
      photo_url: photoUrl,
    })
  } catch (e) {
    return json({ error: `Failed to fetch from PlayHQ: ${e.message}` }, 502)
  }
})
