export function exportPlayersCsv(players) {
  const headers = [
    'name', 'email', 'phone', 'role', 'category',
    'batting_style', 'bowling_style',
    'base_price', 'profile_url',
    'matches', 'runs', 'bat_avg', 'strike_rate',
    'wickets', 'bowl_avg', 'economy',
    'catches', 'status'
  ]
  const lines = [headers.join(',')]
  for (const p of players) {
    const row = headers.map((key) => csvValue(p[key]))
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

const CSV_HEADERS = [
  'name', 'email', 'phone', 'role', 'category',
  'batting_style', 'bowling_style',
  'base_price', 'profile_url',
  'matches', 'runs', 'bat_avg', 'strike_rate',
  'wickets', 'bowl_avg', 'economy',
  'catches', 'status'
]

// A ready-to-fill template with one example row.
export function playersCsvTemplate() {
  const example = [
    'Jane Example', 'jane@example.com', '0400000000', 'Batter', 'Batter',
    'Right-hand bat', 'Right-arm fast',
    '500', 'https://cricheroes.com/player-profile/123/jane-example/stats',
    '20', '850', '42.50', '128.40',
    '2', '25.50', '6.20',
    '6', 'auction'
  ]
  return [CSV_HEADERS.join(','), example.join(',')].join('\n')
}

export function parsePlayersCsv(text) {
  return parsePlayersCsvDetailed(text).rows
}

// Returns { rows, total, skipped, errors } so the UI can report a useful
// validation summary instead of silently dropping bad rows.
export function parsePlayersCsvDetailed(text) {
  const lines = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], total: 0, skipped: 0, errors: ['No data rows found.'] }
  const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase())
  const dataLines = lines.slice(1)
  const rows = []
  const errors = []
  dataLines.forEach((line, idx) => {
    const cols = splitCsvLine(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] ?? '' })
    if (!obj.name) {
      errors.push(`Row ${idx + 2}: missing name — skipped.`)
      return
    }
    const toNum = (v) => (v && v !== '-') ? Number(v) : null
    rows.push({
      name:          obj.name,
      email:         obj.email || null,
      phone:         obj.phone || null,
      role:          obj.role || null,
      category:      obj.category || null,
      batting_style: obj.batting_style || null,
      bowling_style: obj.bowling_style || null,
      base_price:    Number(obj.base_price || 0),
      profile_url:   obj.profile_url || null,
      matches:       toNum(obj.matches),
      runs:          toNum(obj.runs),
      bat_avg:       toNum(obj.bat_avg),
      strike_rate:   toNum(obj.strike_rate),
      wickets:       toNum(obj.wickets),
      bowl_avg:      toNum(obj.bowl_avg),
      economy:       toNum(obj.economy),
      catches:       toNum(obj.catches),
      status:        obj.status || 'registered'
    })
  })
  return { rows, total: dataLines.length, skipped: dataLines.length - rows.length, errors }
}

// ---------------------------------------------------------------------
// Squads export (Bug 10) — one row per sold player, grouped by team.
// Deliberately omits points/PPM/value columns: this is the roster-only
// view for sharing team line-ups without revealing valuation data.
//   teams: rows from listTeamSummaries(auctionId)
//   sold:  rows from listSoldPlayers(auctionId) (joined players + teams)
// ---------------------------------------------------------------------
export function exportSquadsCsv(teams, sold) {
  const headers = ['team', 'slot', 'player', 'role', 'category', 'sold_price']
  const lines = [headers.join(',')]
  const active = (sold ?? []).filter((s) => !s.reauctioned)
  const byTeam = new Map()
  for (const s of active) {
    if (!byTeam.has(s.team_id)) byTeam.set(s.team_id, [])
    byTeam.get(s.team_id).push(s)
  }
  // Stable team order: follow the team_summary ordering passed in.
  for (const t of teams ?? []) {
    const squad = byTeam.get(t.id) ?? []
    squad.forEach((s, i) => {
      lines.push([
        csvValue(t.name),
        csvValue(i + 1),
        csvValue(s.players?.name),
        csvValue(s.players?.role),
        csvValue(s.players?.category),
        csvValue(s.sold_price),
      ].join(','))
    })
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------
// Full auction status export (Bug 11) — a manual-fallback snapshot the
// admin can use to resume the auction by hand if the app is unavailable.
// Emits three labelled sections in one file: team budgets, the run order
// with each player's outcome, and a summary of unsold players.
//   teams:  rows from listTeamSummaries(auctionId)
//   queue:  rows from getQueue(auctionId) (joined players)
//   sold:   rows from listSoldPlayers(auctionId)
// ---------------------------------------------------------------------
export function exportAuctionStatusCsv({ teams = [], queue = [], sold = [] } = {}) {
  const soldByPlayer = new Map(
    (sold ?? []).filter((s) => !s.reauctioned).map((s) => [s.player_id, s])
  )
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))

  const sections = []

  // Section 1 — team budgets
  const teamHeaders = ['team', 'players', 'squad_size', 'spent', 'remaining', 'max_safe_bid']
  const teamLines = ['# TEAMS', teamHeaders.join(',')]
  for (const t of teams) {
    teamLines.push([
      csvValue(t.name),
      csvValue(t.players_count),
      csvValue(t.squad_size),
      csvValue(t.points_spent),
      csvValue(t.points_remaining),
      csvValue(t.max_safe_bid),
    ].join(','))
  }
  sections.push(teamLines.join('\n'))

  // Section 2 — run order with outcome
  const queueHeaders = ['queue_order', 'player', 'category', 'queue_status', 'outcome', 'sold_to', 'sold_price']
  const queueLines = ['# QUEUE', queueHeaders.join(',')]
  for (const q of queue) {
    const sale = soldByPlayer.get(q.player_id)
    const outcome = sale ? 'sold' : (q.players?.status ?? q.status ?? '')
    queueLines.push([
      csvValue(q.queue_order),
      csvValue(q.players?.name),
      csvValue(q.players?.category ?? q.category),
      csvValue(q.status),
      csvValue(outcome),
      csvValue(sale ? teamName.get(sale.team_id) : ''),
      csvValue(sale ? sale.sold_price : ''),
    ].join(','))
  }
  sections.push(queueLines.join('\n'))

  return sections.join('\n\n')
}

// RFC 4180-compliant CSV line splitter — handles quoted commas and escaped quotes
function splitCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function csvValue(value) {
  if (value === null || value === undefined) return ''
  let str = String(value)
  if (/^[=+\-@]/.test(str)) str = `'${str}`
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

