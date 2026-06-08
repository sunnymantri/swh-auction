const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function extractPlayerId(url: string): string | null {
  const match = url.match(/player-profile\/(\d+)/)
  return match?.[1] ?? null
}

function parsePlayerStatement(statement: string) {
  const stats: Record<string, number> = {}
  const clean = statement.replace(/<[^>]+>/g, '')
  const avgMatch = clean.match(/average of\s*([\d.]+)/i)
  if (avgMatch) stats.bat_avg = parseFloat(avgMatch[1])
  const srMatch = clean.match(/strike rate of\s*([\d.]+)/i)
  if (srMatch) stats.strike_rate = parseFloat(srMatch[1])
  const econMatch = clean.match(/economy rate of\s*([\d.]+)/i)
  if (econMatch) stats.economy = parseFloat(econMatch[1])
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const profileUrl = String(body.profile_url ?? '').trim()
  if (!profileUrl) return json({ error: 'profile_url is required' }, 400)

  const playerId = extractPlayerId(profileUrl)
  if (!playerId) return json({ error: 'Could not extract player ID from URL' }, 400)

  try {
    const res = await fetch(
      `https://cricheroes.in/api/v1/player/get-player-profile-web/${playerId}`,
      {
        headers: {
          'api-key': 'cr!CkH3r0s',
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

    const result = {
      name: player.name || null,
      matches: player.total_matches ?? 0,
      runs: player.total_runs ?? 0,
      wickets: statementStats.wickets ?? player.total_wickets ?? 0,
      batting_style: player.batting_hand === 'RHB' ? 'Right-hand bat' :
                     player.batting_hand === 'LHB' ? 'Left-hand bat' : player.batting_hand || null,
      bowling_style: player.bowling_style || null,
      role,
      bat_avg: statementStats.bat_avg ?? 0,
      strike_rate: statementStats.strike_rate ?? 0,
      economy: statementStats.economy ?? 0,
      catches: player.total_catches ?? 0,
      photo_url: player.profile_photo || null
    }

    return json({ ok: true, ...result })
  } catch (e) {
    return json({ error: `Failed to fetch from CricHeroes: ${e.message}` }, 502)
  }
})
