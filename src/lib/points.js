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

export function calcPPM(p) {
  const matches = p.matches || 0
  if (matches === 0) return 0
  return calcTotalPoints(p) / matches
}

export function getTier(ppm) {
  if (ppm >= 55) return { label: 'Platinum', color: 'text-purple-400', base: 15000 }
  if (ppm >= 40) return { label: 'Gold', color: 'text-gold', base: 10000 }
  if (ppm >= 25) return { label: 'Silver', color: 'text-gray-300', base: 5000 }
  return { label: 'Bronze', color: 'text-amber-600', base: 2000 }
}
