// Bid increment tiers — single source of truth for the frontend.
// The DB enforces the same tiers in place_bid (0033); keep in sync.
export const INCREMENT_TIERS = [
  { below: 10000, increment: 100 },
  { below: 15000, increment: 500 },
]
export const INCREMENT_DEFAULT = 1000

export function calcIncrement(currentBid) {
  for (const tier of INCREMENT_TIERS) {
    if (currentBid < tier.below) return tier.increment
  }
  return INCREMENT_DEFAULT
}
