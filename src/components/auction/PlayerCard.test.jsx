import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PlayerCard from './PlayerCard'

describe('PlayerCard', () => {
  it('renders placeholder when no player', () => {
    render(<PlayerCard player={null} />)
    expect(screen.getByText(/No player on the block/i)).toBeInTheDocument()
  })

  it('renders player details', () => {
    render(
      <PlayerCard
        player={{
          name: 'Demo Player',
          role: 'Batter',
          category: 'Batter',
          base_price: 100,
          matches: 1,
          runs: 10,
          wickets: 0,
          catches: 0,
          strike_rate: 125.2,
          economy: 0
        }}
      />
    )
    expect(screen.getByText('Demo Player')).toBeInTheDocument()
    expect(screen.getAllByText('Batter').length).toBeGreaterThan(0)
  })
})

