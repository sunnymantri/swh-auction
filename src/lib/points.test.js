import { describe, expect, it } from 'vitest'
import {
  BASE_PRICE_CONFIG,
  PLATINUM_MIN_MATCHES,
  basePriceForPlayer,
  buildTierIndexByPlayerId,
  calcPPM,
  computeCohortBasePrices,
  getTier,
  getTierFromBasePrice,
  roundToNearest100,
} from './points'

const mk = (id, over = {}) => ({
  id,
  name: id,
  matches: 20,
  runs: 0,
  bat_avg: 0,
  strike_rate: 0,
  fifties: 0,
  hundreds: 0,
  sixes: 0,
  wickets: 0,
  bowl_avg: 0,
  economy: 0,
  dot_balls: 0,
  three_wicket_hauls: 0,
  five_wicket_hauls: 0,
  catches: 0,
  run_outs: 0,
  stumpings: 0,
  ...over,
})

describe('roundToNearest100', () => {
  it('rounds to the nearest hundred deterministically', () => {
    expect(roundToNearest100(5540)).toBe(5500)
    expect(roundToNearest100(5560)).toBe(5600)
    expect(roundToNearest100(5500)).toBe(5500)
  })
})

describe('computeCohortBasePrices — band & ranking', () => {
  // Three batters of clearly increasing quality, all well-credentialled.
  const pool = [
    mk('low', { bat_avg: 15, strike_rate: 90 }),
    mk('mid', { bat_avg: 30, strike_rate: 120 }),
    mk('top', { bat_avg: 55, strike_rate: 160 }),
  ]

  it('maps the top of the cohort to the band ceiling and the bottom to the floor', () => {
    const prices = computeCohortBasePrices(pool)
    expect(prices.top).toBe(BASE_PRICE_CONFIG.maxBase) // 10000
    expect(prices.low).toBe(BASE_PRICE_CONFIG.minBase) // 500
  })

  it('orders prices monotonically with performance', () => {
    const prices = computeCohortBasePrices(pool)
    expect(prices.top).toBeGreaterThan(prices.mid)
    expect(prices.mid).toBeGreaterThan(prices.low)
  })

  it('keeps every price inside the configured band', () => {
    const prices = computeCohortBasePrices(pool)
    for (const v of Object.values(prices)) {
      expect(v).toBeGreaterThanOrEqual(BASE_PRICE_CONFIG.minBase)
      expect(v).toBeLessThanOrEqual(BASE_PRICE_CONFIG.maxBase)
    }
  })

  it('returns an empty map for an empty cohort', () => {
    expect(computeCohortBasePrices([])).toEqual({})
  })

  it('prices a lone player at the band ceiling', () => {
    expect(computeCohortBasePrices([mk('solo', { bat_avg: 40 })]).solo).toBe(BASE_PRICE_CONFIG.maxBase)
  })
})

describe('computeCohortBasePrices — ties', () => {
  it('gives identical players identical base prices', () => {
    const pool = [
      mk('a', { bat_avg: 30, strike_rate: 120 }),
      mk('b', { bat_avg: 30, strike_rate: 120 }),
      mk('c', { bat_avg: 10, strike_rate: 80 }),
    ]
    const prices = computeCohortBasePrices(pool)
    expect(prices.a).toBe(prices.b)
    expect(prices.a).toBeGreaterThan(prices.c)
  })
})

describe('computeCohortBasePrices — credibility shrinkage', () => {
  it('values a small-sample star below a proven, equally-skilled player', () => {
    const pool = [
      mk('veteran', { matches: 40, bat_avg: 45, strike_rate: 140 }),
      mk('rookie', { matches: 2, bat_avg: 45, strike_rate: 140 }),
      mk('filler', { matches: 30, bat_avg: 12, strike_rate: 70 }),
    ]
    const prices = computeCohortBasePrices(pool)
    // Same raw skill, but the 2-match rookie regresses toward the pack.
    expect(prices.veteran).toBeGreaterThan(prices.rookie)
  })
})

describe('computeCohortBasePrices — bowling weights', () => {
  it('weights wickets-per-match above economy', () => {
    const pool = [
      // Heavy wicket-taker, ordinary economy.
      mk('strike', { matches: 20, wickets: 40, economy: 8.0, bowl_avg: 18 }),
      // Miserly but few wickets.
      mk('miser', { matches: 20, wickets: 8, economy: 4.0, bowl_avg: 30 }),
      mk('batter', { bat_avg: 20, strike_rate: 100 }),
    ]
    const prices = computeCohortBasePrices(pool)
    expect(prices.strike).toBeGreaterThan(prices.miser)
  })
})

describe('basePriceForPlayer', () => {
  it('returns the same value as the cohort map for that id', () => {
    const pool = [mk('x', { bat_avg: 50 }), mk('y', { bat_avg: 10 })]
    expect(basePriceForPlayer(pool, 'x')).toBe(computeCohortBasePrices(pool).x)
  })
})

describe('PPM tiers (absolute getTier — retained for PPM-only callers)', () => {
  it('still computes PPM and absolute tiers', () => {
    const player = mk('p', { matches: 27, runs: 193, bat_avg: 11.35, strike_rate: 66.55, wickets: 4, economy: 6.23 })
    expect(calcPPM(player).toFixed(1)).toBe('20.6')
    expect(getTier(calcPPM(player)).label).toBe('Bronze')
  })
})

describe('getTierFromBasePrice — tier tracks base price', () => {
  const { minBase, maxBase } = BASE_PRICE_CONFIG
  const at = (pct) => minBase + (maxBase - minBase) * pct

  it('maps band position to the 10/35/70 tiers', () => {
    expect(getTierFromBasePrice(at(0.95), 20).label).toBe('Platinum')
    expect(getTierFromBasePrice(at(0.70), 20).label).toBe('Gold')
    expect(getTierFromBasePrice(at(0.40), 20).label).toBe('Silver')
    expect(getTierFromBasePrice(at(0.10), 20).label).toBe('Bronze')
  })

  it('blocks Platinum for low-match players regardless of price', () => {
    const fewMatches = PLATINUM_MIN_MATCHES - 1
    expect(getTierFromBasePrice(maxBase, fewMatches).label).not.toBe('Platinum')
    expect(getTierFromBasePrice(maxBase, PLATINUM_MIN_MATCHES).label).toBe('Platinum')
  })

  it('clamps prices outside the band', () => {
    expect(getTierFromBasePrice(maxBase + 5000, 20).label).toBe('Platinum')
    expect(getTierFromBasePrice(minBase - 5000, 20).label).toBe('Bronze')
  })
})

describe('buildTierIndexByPlayerId — cohort tiers via base price', () => {
  it('does not award Platinum to a small-sample star (the reported bug)', () => {
    const pool = [
      mk('veteran', { matches: 40, bat_avg: 45, strike_rate: 140 }),
      mk('rookie', { matches: 2, bat_avg: 45, strike_rate: 140 }),
      mk('filler', { matches: 30, bat_avg: 12, strike_rate: 70 }),
    ]
    const tiers = buildTierIndexByPlayerId(pool)
    // The 2-match rookie is near the price floor → not Platinum, even though
    // their raw PPM (huge over 2 games) would have said otherwise.
    expect(tiers.rookie.label).not.toBe('Platinum')
  })
})
