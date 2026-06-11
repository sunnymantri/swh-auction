# Cricket Player Auction

Full-stack live cricket auction. Players go under the hammer one at a time;
teams bid in points; the app enforces squad-size and budget rules in real time.

**Stack:** React + Vite · Tailwind · Supabase (Postgres + Auth + Storage +
Realtime) · Netlify.

---

## What is in this starter

A fully functioning multi-auction platform: admins create auctions, nominate
teams, upload team/sponsor/banner logos, bulk-upload players, provision
team-owner logins, run live bidding with buy/sell controls, and everyone can
drill into squads and per-player sold prices.

### First admin (one-time bootstrap)
After signing in once (so your `profiles` row exists), promote yourself in the
Supabase SQL editor:

```sql
update public.profiles
set role = 'admin'
where user_id = (select id from auth.users where email = 'YOUR_EMAIL');
```
Sign out and back in. The full admin nav (Auctions, Auction Setup, Teams,
Players, Categories, Queue, Auction Centre, Users) then appears. From the Users
screen an admin can nominate more admins and create team-owner logins.

```
cricket-auction/
├─ index.html
├─ package.json · vite.config.js · tailwind.config.js · postcss.config.js
├─ netlify.toml          # SPA redirect + build
├─ .env.example          # copy to .env.local
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_schema.sql     # 9 tables + indexes
│  │  ├─ 0002_rls.sql        # role helpers + RLS (public read / admin write)
│  │  ├─ 0003_storage.sql    # player-photos + team-logos buckets
│  │  ├─ 0004_logic.sql      # triggers, team_summary view, RPC functions
│  │  ├─ 0005_realtime.sql   # realtime publication
│  │  ├─ 0006_security_hardening.sql # role checks + RPC hardening
│  │  └─ 0007_queue_invariants.sql   # one-current-player constraints
│  └─ seed.sql               # 1 live auction, 6 teams, 30 players, queue
│  └─ tests/
│     └─ rpc_security_checks.sql
└─ src/
   ├─ main.jsx · App.jsx     # full route shell
   ├─ index.css
   └─ lib/
      ├─ supabase.js         # client
      ├─ api.js              # all reads + the RPC wrappers (UI calls this)
      └─ format.js           # AUD / DD-MM-YYYY helpers
```

### Included screens
Login/role select · Dashboard · Auction Setup · Teams · Players ·
Category Config · Auction Centre · Team Bidding ·
Public Live View · Results · Team Squad · Unsold/Re-auction Queue.

---

## Setup

1. **Create a Supabase project**, then run the migrations **in order** in the
   SQL Editor (or `supabase db push` with the CLI):
   `0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008`, then `seed.sql`.
2. **Env:** `cp .env.example .env.local` and paste your Project URL + anon key
   (Project Settings → API).
3. **Run:** `npm install && npm run dev` → http://localhost:5173
   The shell should list the six seeded teams with their budgets and max-safe
   bids, confirming the schema, view, and realtime are wired.
4. **Deploy:** push to Git and connect on Netlify (build `npm run build`,
   publish `dist`). Add the two `VITE_` vars in Netlify env settings.
5. **Tests:** run `npm test` and execute `supabase/tests/rpc_security_checks.sql`
   in Supabase SQL editor for DB-level invariants.

## Team-owner logins (Edge Function)

Creating login accounts for team owners needs the service-role key, so it runs
in a Supabase Edge Function (not in the browser):

```bash
supabase functions deploy admin-create-user
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
platform. The function verifies the caller is an `admin` before creating the
account. In-app, use **Users** or the **Create login** button on **Teams**; the
generated email + password are shown once so you can share them.

The Edge Function runs on Supabase; the front-end stays on Netlify
(`netlify deploy --prod`).

## Security runbook

If any key is leaked, follow `docs/security-incident-runbook.md` immediately.
Rotate first, then perform history cleanup.

---

## How the auction rules are enforced

All state changes go through **SECURITY DEFINER** functions so the rules can't
be bypassed from the browser and are safe under simultaneous bids:

| RPC | Guarantees |
|-----|-----------|
| `place_bid` | locks the team row, checks: beats current bid · meets min increment (unless auctioneer override) · squad not full · **keeps enough points to fill remaining slots at min price**. Rejects with a `BID_REJECTED: …` message the UI shows as the warning. |
| `mark_sold` | records the purchase; a trigger recomputes the team's spend. |
| `mark_unsold` | flags the player, moves them to the unsold queue. |
| `reauction_player` | reverses a sale and requeues. If `reauction_refund_enabled` the points are returned automatically; if not, they stay forfeited but the squad slot is freed. |
| `generate_queue` | rebuilds the run sheet by category sequence then base price. |

**Max safe bid** (shown on every team card) =
`points_remaining − (slots_after_this_purchase × min_player_price)`.
It's computed in the `team_summary` view, so the team budget cards and the bid
panel read the same number.

---

## Demo mode (role selector)

RLS is **public-read / admin-write**, so the Public Live View needs no login.
For the demo role selector, create a Supabase Auth user per role and a matching
row in `profiles` with `role` = `admin` / `team_owner` / `public`; link a
`team_owner` profile to a team via `teams.owner_user_id` so that owner can only
bid for their own team. (For a quick projector-only demo you can drive
everything from a single admin account.)
