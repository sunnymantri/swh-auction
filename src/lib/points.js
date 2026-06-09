// PPM (Points-Per-Match) calculation based on the Auction Base Points Formula.

export function calcBattingPoints(p) {
  return (
    (p.runs || 0) +
    (p.bat_avg || 0) * 10 +
    (p.strike_rate || 0) * 2 +
    (p.fifties || 0) * 25 +
    (p.hundreds || 0) * 50 +
    (p.sixes || 0) * 2
  )
}

export function calcBowlingPoints(p) {
  const economy = Number(p.economy) || 0
  const economyBonus = economy > 0 ? 100 / economy : 0
  return (
    (p.wickets || 0) * 25 +
    economyBonus +
    (p.dot_balls || 0) * 1 +
    (p.three_wicket_hauls || 0) * 25 +
    (p.five_wicket_hauls || 0) * 50
  )
}

export function calcFieldingPoints(p) {
  return (
    (p.catches || 0) * 10 +
    (p.run_outs || 0) * 15 +
    (p.stumpings || 0) * 15
  )
}

export function calcTotalPoints(p) {
  return calcBattingPoints(p) + calcBowlingPoints(p) + calcFieldingPoints(p)
}

export function roundToNearest100(value) {
  return Math.round((Number(value) || 0) / 100) * 100
}

export function calcBasePriceFromStats(p) {
  return roundToNearest100(calcTotalPoints(p) * 10)
}

export function calcPPM(p) {
  const matches = p.matches || 0
  if (matches === 0) return 0
  return calcTotalPoints(p) / matches
}

function tierFromRank(rank, total) {
  if (total <= 0) return { label: 'Bronze', color: 'text-amber-600', base: 2000 }
  const platinumMaxRank = Math.max(1, Math.ceil(total * 0.10))
  const goldMaxRank = Math.max(platinumMaxRank, Math.ceil(total * 0.35))
  const silverMaxRank = Math.max(goldMaxRank, Math.ceil(total * 0.70))

  if (rank <= platinumMaxRank) return { label: 'Platinum', color: 'text-purple-400', base: 15000 }
  if (rank <= goldMaxRank) return { label: 'Gold', color: 'text-gold', base: 10000 }
  if (rank <= silverMaxRank) return { label: 'Silver', color: 'text-gray-300', base: 5000 }
  return { label: 'Bronze', color: 'text-amber-600', base: 2000 }
}

export function buildTierIndexByPlayerId(players = []) {
  const ranked = (players || [])
    .filter((p) => p?.id)
    .map((p) => ({ id: p.id, ppm: calcPPM(p), name: p.name || '' }))
    .sort((a, b) => {
      if (b.ppm !== a.ppm) return b.ppm - a.ppm
      return a.name.localeCompare(b.name)
    })

  const total = ranked.length
  const byId = {}
  ranked.forEach((entry, idx) => {
    byId[entry.id] = tierFromRank(idx + 1, total)
  })
  return byId
}

export function getTierForPlayer(players = [], playerId, fallbackPPM = 0) {
  const byId = buildTierIndexByPlayerId(players)
  return byId[playerId] || getTier(fallbackPPM)
}

export function getTier(ppm) {
  // Product decision: keep 55.0 in Platinum (inclusive boundary).
  if (ppm >= 55) return { label: 'Platinum', color: 'text-purple-400', base: 15000 }
  if (ppm >= 40) return { label: 'Gold', color: 'text-gold', base: 10000 }
  if (ppm >= 25) return { label: 'Silver', color: 'text-gray-300', base: 5000 }
  return { label: 'Bronze', color: 'text-amber-600', base: 2000 }
}
