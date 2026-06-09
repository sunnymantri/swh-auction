# Auction Base Points Calculation Formula

A production-ready formula blueprint that converts cumulative lifetime stats into a **Points-Per-Match (PPM)** index. This prevents veteran players with hundreds of games from completely overwhelming newer, highly skilled players.

---

## The Universal Performance Formula

To evaluate any player fairly, calculate their points across the three core areas, sum them up, and divide by their total matches played.

```
Final Performance Score (PPM) = (Batting Points + Bowling Points + Fielding Points) / Total Matches
```

```
Base Price = roundToNearest100((Batting Points + Bowling Points + Fielding Points) x 10)
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

## Auction Tiering Matrix (PPM Only)

Once you calculate the Final PPM for every player, map their score to this tier system for classification only (label + styling):

| Final PPM Range | Player Tier | Player Profile Description |
|----------------|-------------|---------------------------|
| 55.0 and above | Tier 1: Platinum | Elite Marquee All-Rounders / Match-winning Pros |
| 40.0 - 54.9 | Tier 2: Gold | High-impact frontline batsmen or primary opening bowlers |
| 25.0 - 39.9 | Tier 3: Silver | Dependable utility squad players and stable anchors |
| Under 25.0 | Tier 4: Bronze | Emerging young talent, bench depth, or pure specialists |

---

## Base Price Derivation (Auction Start Price)

Base price is not tier-fixed. It is derived directly from total points:

```
Total Points = Batting Points + Bowling Points + Fielding Points
Scaled Points = Total Points x 10
Base Price = roundToNearest100(Scaled Points)
```

Rounding rule examples:
- 5,540 -> 5,500
- 5,560 -> 5,600
- 5,500 -> 5,500

---

## Example Verification

**Sample Player Stats:**
- Aggregate metrics yielded **556 total points** across **27 matches**
- PPM = 556 / 27 = **20.6 PPM** -> **Tier 4 (Bronze)**
- Base Price = roundToNearest100(556 x 10) = roundToNearest100(5,560) = **5,600**

---

## Implementation Notes

- All stats are cumulative lifetime stats from CricHeroes profiles
- Economy rate of 0 should be handled as a special case (set bowling economy contribution to 0)
- Players with fewer than a minimum match threshold (e.g., 5 matches) may need manual tier assignment
- The formula is role-agnostic — pure batsmen naturally score 0 in bowling, and vice versa
- Tier comes from PPM only; base price comes from scaled+rounded total points
