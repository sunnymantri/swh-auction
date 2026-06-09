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
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

