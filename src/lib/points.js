// =====================================================================
//  Auction scoring & base-price model
// ---------------------------------------------------------------------
//  Two separate concepts live here:
//
//  1. PERFORMANCE POINTS / PPM / TIERS  (calcBattingPoints, getTier, …)
//     A per-player indicative score used for display only. Unchanged.
//
//  2. BASE PRICE  (computeCohortBasePrices)
//     Cohort-relative. A player's base price depends on where they rank
//     against everyone else in the approved pool — NOT on an absolute
//     formula. Scores are percentile-normalised so outliers can't blow
//     the numbers up, then mapped onto a fixed [minBase, maxBase] band.
// =====================================================================

// ----- Tunable configuration -----------------------------------------
export const BASE_PRICE_CONFIG = {
  minBase: 500,        // band floor  → bottom of the cohort
  maxBase: 10000,      // band ceiling → top of the cohort
  credibilityK: 8,     // matches-based shrinkage: cred = m / (m + K)
  disciplineWeight: 0.85, // weight on the stronger of batting/bowling
  fieldingWeight: 0.15,   // weight on fielding/keeping
  // Within batting, how much each rate metric counts:
  battingWeights: { avg: 0.45, strikeRate: 0.45, milestones: 0.10 },
  // Within bowling — wickets/match leads, then economy, then average:
  bowlingWeights: { wicketsPerMatch: 0.50, economy: 0.30, average: 0.20 },
}

// ----- small helpers --------------------------------------------------
const num = (v) => Number(v) || 0
const perMatch = (value, matches) => (matches > 0 ? value / matches : 0)
const isBowler = (p) => num(p.economy) > 0 || num(p.wickets) > 0

// Mid-rank percentile (0..1) for each entry, robust to ties & outliers.
// entries: [{ id, value }]  →  { [id]: percentile }
function percentileById(entries) {
  const out = {}
  const n = entries.length
  if (n === 0) return out
  if (n === 1) { out[entries[0].id] = 1; return out }
  const values = entries.map((e) => e.value)
  for (const e of entries) {
    let below = 0
    let equal = 0
    for (const v of values) {
      if (v < e.value) below += 1
      else if (v === e.value) equal += 1
    }
    // average rank for ties, normalised so worst → 0, best → 1
    out[e.id] = (below + (equal - 1) / 2) / (n - 1)
  }
  return out
}

// =====================================================================
//  PERFORMANCE POINTS (display only — not money)
// =====================================================================
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

export function calcPPM(p) {
  const matches = p.matches || 0
  if (matches === 0) return 0
  return calcTotalPoints(p) / matches
}

// =====================================================================
//  BASE PRICE — cohort-relative
// =====================================================================

// Per-discipline 0..100 scores + credibility-weighted composite for a
// single player, given the percentile lookups built across the cohort.
function disciplineScores(p, pcts, cfg) {
  const bw = cfg.battingWeights
  const ow = cfg.bowlingWeights

  const batting = 100 * (
    bw.avg * (pcts.batAvg[p.id] || 0) +
    bw.strikeRate * (pcts.batSR[p.id] || 0) +
    bw.milestones * (pcts.batMilestones[p.id] || 0)
  )

  const bowling = isBowler(p)
    ? 100 * (
        ow.wicketsPerMatch * (pcts.wicketsPM[p.id] || 0) +
        ow.economy * (pcts.economy[p.id] || 0) +
        ow.average * (pcts.bowlAvg[p.id] || 0)
      )
    : 0

  const fielding = 100 * (pcts.dismissalsPM[p.id] || 0)

  const discipline =
    Math.max(batting, bowling) * cfg.disciplineWeight +
    fielding * cfg.fieldingWeight

  const m = num(p.matches)
  const credibility = m > 0 ? m / (m + cfg.credibilityK) : 0

  return { batting, bowling, fielding, composite: discipline * credibility }
}

/**
 * Compute base prices for an entire cohort at once.
 *
 * Returns a plain object: { [playerId]: basePrice }.
 *
 * Pass the full player list. To price only the approved pool later, just
 * pre-filter the array you hand in (e.g. players.filter(p => p.approved)).
 *
 * @param {Array} players
 * @param {object} [options] overrides merged over BASE_PRICE_CONFIG
 */
export function computeCohortBasePrices(players = [], options = {}) {
  const cfg = {
    ...BASE_PRICE_CONFIG,
    ...options,
    battingWeights: { ...BASE_PRICE_CONFIG.battingWeights, ...(options.battingWeights || {}) },
    bowlingWeights: { ...BASE_PRICE_CONFIG.bowlingWeights, ...(options.bowlingWeights || {}) },
  }

  const pool = (players || []).filter((p) => p && p.id != null)
  const result = {}
  if (pool.length === 0) return result

  // --- metric percentiles -------------------------------------------
  // Batting & fielding percentiles span the whole cohort.
  // Bowling percentiles span bowlers only, so non-bowlers score 0 there
  // instead of being lifted by a crowd of zero-economy batters.
  const bowlers = pool.filter(isBowler)

  const pcts = {
    batAvg: percentileById(pool.map((p) => ({ id: p.id, value: num(p.bat_avg) }))),
    batSR: percentileById(pool.map((p) => ({ id: p.id, value: num(p.strike_rate) }))),
    batMilestones: percentileById(pool.map((p) => ({
      id: p.id,
      value: perMatch(num(p.fifties) + 2 * num(p.hundreds), num(p.matches)),
    }))),
    wicketsPM: percentileById(bowlers.map((p) => ({
      id: p.id,
      value: perMatch(num(p.wickets), num(p.matches)),
    }))),
    economy: percentileById(bowlers.map((p) => ({
      id: p.id,
      value: num(p.economy) > 0 ? 1 / num(p.economy) : 0, // lower economy → higher score
    }))),
    bowlAvg: percentileById(bowlers.map((p) => ({
      id: p.id,
      value: num(p.bowl_avg) > 0 ? 1 / num(p.bowl_avg) : 0, // lower average → higher score
    }))),
    dismissalsPM: percentileById(pool.map((p) => ({
      id: p.id,
      value: perMatch(num(p.catches) + num(p.run_outs) + num(p.stumpings), num(p.matches)),
    }))),
  }

  // --- composite per player -----------------------------------------
  const composites = pool.map((p) => ({
    id: p.id,
    value: disciplineScores(p, pcts, cfg).composite,
  }))

  // --- map composite RANK to the price band -------------------------
  const rankPct = percentileById(composites)
  const span = cfg.maxBase - cfg.minBase
  for (const c of composites) {
    result[c.id] = roundToNearest100(cfg.minBase + span * (rankPct[c.id] || 0))
  }
  return result
}

/** Convenience: base price for one player within a given cohort. */
export function basePriceForPlayer(players = [], playerId, options = {}) {
  return computeCohortBasePrices(players, options)[playerId]
}

// =====================================================================
//  TIERS (display only) — derived from the cohort-relative BASE PRICE
// ---------------------------------------------------------------------
//  Tier and base price are now the *same* signal, so they can never
//  disagree (the old bug: a 2-match player whose raw PPM was huge showed
//  "Platinum" while their credibility-shrunk base price sat near the
//  floor). Base price already bakes in cohort rank + small-sample
//  shrinkage, so the tier inherits both for free.
//
//  Mapping: base price lives on [minBase, maxBase]; its position in that
//  band is the player's cohort percentile. We cut it on the same
//  10% / 35% / 70% bands the old rank tiers used. A small-sample guard
//  blocks Platinum below PLATINUM_MIN_MATCHES regardless of price.
// =====================================================================

// Minimum matches a player must have played to qualify for Platinum.
export const PLATINUM_MIN_MATCHES = 10

const TIER = {
  platinum: { label: 'Platinum', color: 'text-purple-400', base: 15000 },
  gold:     { label: 'Gold',     color: 'text-gold',       base: 10000 },
  silver:   { label: 'Silver',   color: 'text-gray-300',   base: 5000 },
  bronze:   { label: 'Bronze',   color: 'text-amber-600',  base: 2000 },
}

// Where a base price sits inside the configured band, clamped to [0,1].
function basePricePercentile(basePrice, cfg = BASE_PRICE_CONFIG) {
  const span = cfg.maxBase - cfg.minBase
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (num(basePrice) - cfg.minBase) / span))
}

// Tier from a player's cohort-relative base price + match count.
// matches gates Platinum only; the rest follow the price band.
export function getTierFromBasePrice(basePrice, matches = 0, cfg = BASE_PRICE_CONFIG) {
  const pct = basePricePercentile(basePrice, cfg)
  if (pct >= 0.90 && num(matches) >= PLATINUM_MIN_MATCHES) return TIER.platinum
  if (pct >= 0.65) return TIER.gold
  if (pct >= 0.30) return TIER.silver
  return TIER.bronze
}

// Cohort tier lookup: re-prices the pool, then maps each player's base
// price to a tier. Same { [id]: tier } shape as before.
export function buildTierIndexByPlayerId(players = [], options = {}) {
  const pool = (players || []).filter((p) => p?.id)
  const priceById = computeCohortBasePrices(pool, options)
  const byId = {}
  for (const p of pool) {
    byId[p.id] = getTierFromBasePrice(priceById[p.id], p.matches)
  }
  return byId
}

export function getTierForPlayer(players = [], playerId, fallbackPlayer = null) {
  const byId = buildTierIndexByPlayerId(players)
  if (byId[playerId]) return byId[playerId]
  return getTierFromBasePrice(fallbackPlayer?.base_price, fallbackPlayer?.matches)
}

// Absolute PPM → tier. Retained for any caller that only has a PPM and no
// cohort/base-price context; prefer getTierFromBasePrice where a base price
// is available so the tier agrees with the price.
export function getTier(ppm) {
  // Product decision: keep 55.0 in Platinum (inclusive boundary).
  if (ppm >= 55) return TIER.platinum
  if (ppm >= 40) return TIER.gold
  if (ppm >= 25) return TIER.silver
  return TIER.bronze
}
