# Auction Base Points & Base Price Calculation

This document describes how the app scores players and derives their **auction base price**.

There are **two independent concepts** — don't confuse them:

1. **Performance Points / PPM / Tiers** — a per-player indicative score used for *display only* (the points breakdown on the player card and the Platinum/Gold/Silver/Bronze label). Unchanged.
2. **Base Price** — the money a player starts at in the auction. As of **v2.6** this is **cohort-relative**: a player's base price depends on where they rank against the whole approved pool, not on an absolute formula.

> **Why the change?** The old base price was `roundToNearest100(totalPoints × 10)`. Because it summed *cumulative* lifetime stats (runs, wickets, dot balls), high-volume players ballooned to absurd values (₹45,000+) while specialists collapsed to a few hundred. The new model is bounded by design: everyone lands inside a fixed ₹500–₹10,000 band, spread by percentile rank.

---

## Part 1 — Base Price (cohort-relative)  ⭐ current model

### The idea in one line

> Rank every approved player by a credibility-weighted, percentile-normalised composite score, then map that rank onto the **₹500 – ₹10,000** band.

Top of the cohort → ₹10,000. Bottom → ₹500. Median → ~₹5,250. The spread is predictable regardless of how skewed the raw stats are.

### Step 1 — Use rates, not totals

Cumulative counters (total runs, total wickets, total dot balls) are **not** used as direct inputs — they reward volume, not skill. Instead we use rate / per-match metrics:

| Discipline | Metrics used |
|-----------|--------------|
| Batting | Batting Average, Strike Rate, Milestones per match `(50s + 2×100s) / matches` |
| Bowling | **Wickets per match**, `1 / Economy`, `1 / Bowling Average` |
| Fielding | Dismissals per match `(catches + run outs + stumpings) / matches` |

### Step 2 — Percentile-normalise each metric

For each metric, every player gets a **percentile (0–1)** versus the cohort (mid-rank, so ties share a value and outliers can't dominate). Bowling percentiles are computed **among bowlers only**, so non-bowlers correctly score 0 in bowling rather than being lifted by a crowd of zero-economy batters.

### Step 3 — Combine into discipline scores (0–100)

```
Batting Score = 100 × ( 0.45·pct(Avg) + 0.45·pct(SR) + 0.10·pct(Milestones/match) )

Bowling Score = 100 × ( 0.50·pct(Wickets/match) + 0.30·pct(1/Economy) + 0.20·pct(1/BowlAvg) )

Fielding Score = 100 × pct(Dismissals/match)
```

> **Bowling weighting (v2.6):** wickets-per-match leads at **0.50**, economy is second at **0.30**, bowling average third at **0.20**. Wicket-takers are valued above purely economical bowlers.

### Step 4 — Pick the stronger suit + add fielding

```
Discipline Score = max(Batting Score, Bowling Score) × 0.85  +  Fielding Score × 0.15
```

Using `max(batting, bowling)` means all-rounders are valued by their **stronger** discipline instead of being averaged down.

### Step 5 — Credibility shrinkage (sample size)

A 2-match wonder shouldn't outrank a proven 30-match player. Each score is shrunk toward the pack by:

```
Credibility = matches / (matches + K)        // K = 8
Composite   = Discipline Score × Credibility
```

### Step 6 — Map rank → price band

```
percentile = rank of Composite within the cohort   // worst = 0.0, best = 1.0
Base Price = roundToNearest100( 500 + 9500 × percentile )
```

| Position in cohort | Base Price |
|--------------------|-----------|
| Top player | ₹10,000 |
| Median player | ~₹5,250 |
| Bottom player | ₹500 |
| Tied players | identical price |
| Lone player (cohort of 1) | ₹10,000 |

### Tunable configuration

All knobs live in `BASE_PRICE_CONFIG` at the top of `src/lib/points.js` — change them in one place:

```js
export const BASE_PRICE_CONFIG = {
  minBase: 500,
  maxBase: 10000,
  credibilityK: 8,
  disciplineWeight: 0.85,
  fieldingWeight: 0.15,
  battingWeights: { avg: 0.45, strikeRate: 0.45, milestones: 0.10 },
  bowlingWeights: { wicketsPerMatch: 0.50, economy: 0.30, average: 0.20 },
}
```

### When it runs

Base prices are recomputed **only on demand** (admin clicks **“Recalculate base prices”** on the Players screen). Saving a player, editing, or importing a CSV does **not** auto-reprice — those keep the entered/default base price until the next recalculation. This keeps prices stable and predictable right up to auction time.

> **Cohort scope:** today the cohort is *every* player. A status filter (e.g. only approved/registered players) is a one-line change in `computeCohortBasePrices` — pre-filter the list passed in.

### Implementation

- `computeCohortBasePrices(players, options?)` → `{ [playerId]: basePrice }`
- `basePriceForPlayer(players, playerId, options?)` → price for one player within a cohort
- Both live in `src/lib/points.js`; covered by `src/lib/points.test.js`.

---

## Part 2 — Performance Points, PPM & Tiers (display only)

These are unchanged and are **not** used for base price. They drive the points breakdown card and the tier label.

### Batting Points

```
Batting Points = Runs + (Avg × 10) + (SR × 2) + (50s × 25) + (100s × 50) + (6s × 2)
```

### Bowling Points

```
Bowling Points = (Wickets × 25) + (100 / Economy) + (Dot Balls × 1) + (3w × 25) + (5w × 50)
```

### Fielding Points

```
Fielding Points = (Catches × 10) + (Run Outs × 15) + (Stumpings × 15)
```

### PPM & Tier

```
PPM = (Batting + Bowling + Fielding Points) / Matches
```

| Final PPM Range | Tier | Profile |
|----------------|------|---------|
| 55.0+ | Platinum | Elite marquee all-rounders / match-winners |
| 40.0 – 54.9 | Gold | High-impact frontline batters or opening bowlers |
| 25.0 – 39.9 | Silver | Dependable utility players, anchors |
| Under 25.0 | Bronze | Emerging talent, bench depth, specialists |

---

## Notes & edge cases

- Economy / bowling average of 0 are treated as "no bowling contribution" (score 0), not divide-by-zero.
- A player with 0 matches gets credibility 0 → lands at the band floor.
- The model is role-agnostic: pure batters score 0 in bowling and vice-versa; `max()` ensures they're priced on their real strength.
- Stats are cumulative lifetime figures sourced from CricHeroes profiles.

---

## Versioning

The app version (shown in the footer as `vMAJOR.MINOR`) auto-increments by **+0.1 on every commit** via the `.githooks/pre-commit` hook running `scripts/bump-version.mjs` (minor +1, patch reset). Enable once per clone with `npm run setup:hooks`.

### Changelog

| Version | Change |
|---------|--------|
| **v2.6** | Base price reworked to cohort-relative percentile model (₹500–₹10,000 band); rate-based metrics; credibility shrinkage; bowling now led by wickets/match. Added auto version-bump on commit. |
| v2.5 | Legacy: `Base Price = roundToNearest100(totalPoints × 10)`. |
