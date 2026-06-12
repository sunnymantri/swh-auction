import { describe, expect, it } from 'vitest'
import { calcIncrement, INCREMENT_TIERS, INCREMENT_DEFAULT } from './bidding'

describe('calcIncrement — tier boundaries', () => {
  it('returns 100 below the first tier threshold', () => {
    expect(calcIncrement(0)).toBe(100)
    expect(calcIncrement(9999)).toBe(100)
  })

  it('returns 500 at and above the first threshold', () => {
    expect(calcIncrement(10000)).toBe(500)
    expect(calcIncrement(14999)).toBe(500)
  })

  it('returns the default increment at and above the second threshold', () => {
    expect(calcIncrement(15000)).toBe(INCREMENT_DEFAULT)
    expect(calcIncrement(99999)).toBe(INCREMENT_DEFAULT)
  })

  it('tier thresholds match the DB constants in 0033', () => {
    // If this test fails after a tier change, update place_bid in the DB too.
    expect(INCREMENT_TIERS[0]).toEqual({ below: 10000, increment: 100 })
    expect(INCREMENT_TIERS[1]).toEqual({ below: 15000, increment: 500 })
    expect(INCREMENT_DEFAULT).toBe(1000)
  })
})
