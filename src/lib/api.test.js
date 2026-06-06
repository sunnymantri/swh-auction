import { describe, expect, it } from 'vitest'
import { exportPlayersCsv, parsePlayersCsv } from './csv'

describe('players csv helpers', () => {
  it('exports and parses a row', () => {
    const csv = exportPlayersCsv([
      {
        name: 'A Test Batter',
        email: 'a@test.com',
        phone: '0400000000',
        role: 'Batter',
        category: 'Batter',
        base_price: 200,
        matches: 10,
        runs: 400,
        wickets: 0,
        catches: 4,
        strike_rate: 130.5,
        economy: 0,
        status: 'approved'
      }
    ])
    const rows = parsePlayersCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('A Test Batter')
    expect(rows[0].base_price).toBe(200)
    expect(rows[0].status).toBe('approved')
  })

  it('ignores empty CSV bodies', () => {
    expect(parsePlayersCsv('name,role\n')).toEqual([])
  })
})

