import { describe, expect, it } from 'vitest'
import { exportPlayersCsv, parsePlayersCsv, exportSquadsCsv, exportAuctionStatusCsv } from './csv'

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
        status: 'auction'
      }
    ])
    const rows = parsePlayersCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('A Test Batter')
    expect(rows[0].base_price).toBe(200)
    expect(rows[0].status).toBe('auction')
  })

  it('ignores empty CSV bodies', () => {
    expect(parsePlayersCsv('name,role\n')).toEqual([])
  })
})

describe('exportSquadsCsv', () => {
  const teams = [{ id: 't1', name: 'Spartans' }, { id: 't2', name: 'Titans' }]
  const sold = [
    { id: 's1', team_id: 't1', player_id: 'p1', sold_price: 1200, reauctioned: false,
      players: { name: 'Alice', role: 'Batter', category: 'Bat' } },
    { id: 's2', team_id: 't1', player_id: 'p2', sold_price: 800, reauctioned: false,
      players: { name: 'Bob', role: 'Bowler', category: 'Bowl' } },
    { id: 's3', team_id: 't2', player_id: 'p3', sold_price: 500, reauctioned: true,
      players: { name: 'Carol', role: 'AR', category: 'AR' } },
  ]

  it('groups active sales by team and omits points/reauctioned', () => {
    const csv = exportSquadsCsv(teams, sold)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('team,slot,player,role,category,sold_price')
    expect(lines).toContain('Spartans,1,Alice,Batter,Bat,1200')
    expect(lines).toContain('Spartans,2,Bob,Bowler,Bowl,800')
    // Carol was re-auctioned away → excluded.
    expect(csv).not.toContain('Carol')
  })
})

describe('exportAuctionStatusCsv', () => {
  it('emits team and queue sections with sale outcomes', () => {
    const csv = exportAuctionStatusCsv({
      teams: [{ id: 't1', name: 'Spartans', players_count: 1, squad_size: 11,
                points_spent: 1200, points_remaining: 8800, max_safe_bid: 8800 }],
      queue: [
        { player_id: 'p1', queue_order: 1, status: 'completed', players: { name: 'Alice', category: 'Bat', status: 'sold' } },
        { player_id: 'p2', queue_order: 2, status: 'pending', players: { name: 'Bob', category: 'Bowl', status: 'ready_for_auction' } },
      ],
      sold: [{ player_id: 'p1', team_id: 't1', sold_price: 1200, reauctioned: false }],
    })
    expect(csv).toContain('# TEAMS')
    expect(csv).toContain('Spartans,1,11,1200,8800,8800')
    expect(csv).toContain('# QUEUE')
    // Alice sold to Spartans for 1200; Bob still pending.
    expect(csv).toContain('1,Alice,Bat,completed,sold,Spartans,1200')
    expect(csv).toContain('2,Bob,Bowl,pending,ready_for_auction,,')
  })
})

