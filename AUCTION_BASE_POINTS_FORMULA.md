# Auction Base Points Calculation Formula

A production-ready formula blueprint that converts cumulative lifetime stats into a **Points-Per-Match (PPM)** index. This prevents veteran players with hundreds of games from completely overwhelming newer, highly skilled players.

---

## The Universal Performance Formula

To evaluate any player fairly, calculate their points across the three core areas, sum them up, and divide by their total matches played.

```
Final Performance Score (PPM) = (Batting Points + Bowling Points + Fielding Points) / Total Matches
```

---

## Step-by-Step Sub-Formulas

### 1. Batting Points Formula

Balances standard run accumulation with scoring speed (Strike Rate) and impact boundaries.

```
Batting Points = Runs + (Avg x 10) + (SR x 2) + (50s x 25) + (100s x 50) + (6s x 2)
```

| Component | Multiplier | Rationale |
|-----------|-----------|-----------|
| Runs | 1 point per run | Base scoring contribution |
| Average | x 10 | Rewards consistency (e.g., 25.0 avg = 250 pts) |
| Strike Rate | x 2 | Rewards quick scoring |
| Half-centuries | x 25 | Milestone bonus |
| Centuries | x 50 | Milestone bonus |
| Sixes | x 2 | Favors power hitters |

---

### 2. Bowling Points Formula

Heavily rewards taking wickets and maintaining a low economy rate.

```
Bowling Points = (Wickets x 25) + (100 / Economy) + (Dot Balls x 1) + (3w Hauls x 25) + (5w Hauls x 50)
```

| Component | Multiplier | Rationale |
|-----------|-----------|-----------|
| Wickets | x 25 | Numerical equivalent of scoring 25 runs |
| Economy | 100 / Economy | Inverted — tight bowlers get significantly more points |
| Dot Balls | x 1 | Rewards building match pressure |
| 3-wicket hauls | x 25 | Milestone bonus |
| 5-wicket hauls | x 50 | Milestone bonus |

---

### 3. Fielding Points Formula

Ensures specialized wicketkeepers and electric outfielders get a fair valuation boost.

```
Fielding Points = (Catches x 10) + (Run Outs x 15) + (Stumpings x 15)
```

| Component | Multiplier | Rationale |
|-----------|-----------|-----------|
| Catches | x 10 | Standard fielding contribution |
| Run Outs | x 15 | Higher reward (divided evenly if assisted) |
| Stumpings | x 15 | Specialist keeper contribution |

---

## Auction Tiering Matrix

Once you calculate the Final PPM for every player, map their score to this tier system to determine their auction base price:

| Final PPM Range | Player Tier | Player Profile Description | Suggested Base Price |
|----------------|-------------|---------------------------|---------------------|
| Over 55.0 | Tier 1: Platinum | Elite Marquee All-Rounders / Match-winning Pros | 15,000 Credits |
| 40.0 - 54.9 | Tier 2: Gold | High-impact frontline batsmen or primary opening bowlers | 10,000 Credits |
| 25.0 - 39.9 | Tier 3: Silver | Dependable utility squad players and stable anchors | 5,000 Credits |
| Under 25.0 | Tier 4: Bronze | Emerging young talent, bench depth, or pure specialists | 2,000 Credits |

---

## Example Verification

**Sunny Mantri's Stats:**
- Aggregate metrics yielded **13,687.21 total points** across **222 matches**
- PPM = 13,687.21 / 222 = **61.65 PPM**
- Tier placement: **Tier 1 (Platinum)** — Elite marquee asset

---

## Implementation Notes

- All stats are cumulative lifetime stats from CricHeroes profiles
- Economy rate of 0 should be handled as a special case (set bowling economy contribution to 0)
- Players with fewer than a minimum match threshold (e.g., 5 matches) may need manual tier assignment
- The formula is role-agnostic — pure batsmen naturally score 0 in bowling, and vice versa
