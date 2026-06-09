import { describe, expect, it } from 'vitest'
import { calcBasePriceFromStats, calcPPM, calcTotalPoints, getTier, roundToNearest100 } from './points'

describe('base price formula helpers', () => {
  it('rounds to nearest hundred deterministically', () => {
    expect(roundToNearest100(5540)).toBe(5500)
    expect(roundToNearest100(5560)).toBe(5600)
    expect(roundToNearest100(5500)).toBe(5500)
  })

  it('calculates base price from total points x10', () => {
    const player = {
      matches: 27,
      runs: 193,
      bat_avg: 11.35,
      strike_rate: 66.55,
      wickets: 4,
      economy: 6.23,
      catches: 0,
      fifties: 0,
      hundreds: 0,
      sixes: 0,
      dot_balls: 0,
      three_wicket_hauls: 0,
      five_wicket_hauls: 0,
      run_outs: 0,
      stumpings: 0
    }
    const total = calcTotalPoints(player)
    expect(total.toFixed(0)).toBe('556')
    expect(calcBasePriceFromStats(player)).toBe(5600)
  })

  it('keeps tier based on ppm regardless of base price formula', () => {
    const player = {
      matches: 27,
      runs: 193,
      bat_avg: 11.35,
      strike_rate: 66.55,
      wickets: 4,
      economy: 6.23,
      catches: 0
    }
    const ppm = calcPPM(player)
    expect(ppm.toFixed(1)).toBe('20.6')
    expect(getTier(ppm).label).toBe('Bronze')
    expect(calcBasePriceFromStats(player)).toBe(5600)
  })
})
