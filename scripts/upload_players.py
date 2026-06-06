#!/usr/bin/env python3
"""
Upload players from Auction-Exported-Players.xlsx to Supabase.

Behaviour:
  - Targets the single existing "SWH Challenger Cup" auction.
  - Deletes all seed/existing players for that auction first (clean slate).
  - Inserts all 57 real players from the spreadsheet.
  - base_price is stored as round(baseBid × 1000) so "6" → 6 000 pts,
    fitting naturally inside the 100 000-point team budget.
  - profile_url is taken verbatim from the sheet (first URL only if multiple
    are present in the cell, which happens for a couple of rows).
  - Stats fields are coerced to numeric; empty / '-' cells become None.
"""

import json
import math
import re
import sys
import urllib.request
import urllib.error
import openpyxl

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL  = "https://sibvkudjhshdwqcrywdj.supabase.co"
SERVICE_KEY   = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYnZrdWRqaHNoZHdxY3J5d2RqIiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYyNjY4MywiZXhwIjoyMDk2MjAyNjgzfQ"
    ".82sxy1hbvHwLbJSO19cNdPpOjNWD8eG7ZdFrnTc3FsI"
)
XLSX_PATH     = "Auction-Exported-Players.xlsx"
AUCTION_NAME  = "SWH Challenger Cup"

HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

# Map Excel PlayerType values → canonical DB role and category
ROLE_MAP = {
    "all-rounder":   "All-rounder",
    "wicket keeper": "Wicketkeeper",
    "batsman":       "Batter",
    "batter":        "Batter",
    "bowler":        "Bowler",
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def api(method: str, path: str, body=None):
    url  = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  HTTP {e.code} on {method} {path}: {err}", file=sys.stderr)
        raise


def to_num(val, places=2):
    """Convert a cell value to float or None. Handles '-', '', None."""
    if val is None:
        return None
    s = str(val).strip()
    if s in ("", "-", "N/A"):
        return None
    try:
        return round(float(s), places)
    except ValueError:
        return None


def to_int(val):
    n = to_num(val, 0)
    return int(n) if n is not None else None


def first_url(raw):
    """Return the first URL from a possibly multi-line / multi-URL cell."""
    if not raw:
        return None
    urls = re.findall(r'https?://\S+', str(raw).strip())
    return urls[0] if urls else str(raw).strip() or None


def canonical_role(raw):
    if not raw:
        return None
    return ROLE_MAP.get(str(raw).strip().lower(), str(raw).strip())


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # 1. Find auction
    auctions = api("GET", f"auctions?select=id,name&name=eq.{urllib.parse.quote(AUCTION_NAME)}")
    if not auctions:
        # fallback: grab the first auction
        auctions = api("GET", "auctions?select=id,name&limit=1")
    if not auctions:
        sys.exit("No auctions found in DB. Create one first.")
    auction = auctions[0]
    auction_id = auction["id"]
    print(f"Target auction: '{auction['name']}' ({auction_id})")

    # 2. Delete existing players (seed data) for this auction
    print("Deleting existing players for this auction…")
    # must also clear related rows that FK-reference players
    existing = api("GET", f"players?select=id&auction_id=eq.{auction_id}")
    if existing:
        ids = [p["id"] for p in existing]
        print(f"  Removing {len(ids)} existing players and their related records…")
        # cascade-delete via auction_events, bids, sold_players, auction_queue
        # (all have ON DELETE CASCADE from players)
        api("DELETE", f"players?auction_id=eq.{auction_id}")
        print("  Done.")

    # 3. Parse Excel
    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    # Row 0 = machine headers, Row 1 = human-readable labels, Rows 2+ = data
    data_rows = rows[2:]
    print(f"Parsing {len(data_rows)} player rows from spreadsheet…")

    players = []
    skipped = []
    for i, row in enumerate(data_rows, start=3):
        player_no, name, photo_url, player_type, spec1, spec2, \
            base_bid, profile_url_raw, is_approved, \
            stat_matches, stat_runs, stat_bat_avg, stat_bat_sr, \
            stat_wickets, stat_bowl_avg, stat_economy = row

        name = str(name).strip() if name else ""
        if not name:
            skipped.append(f"Row {i}: empty name — skipped")
            continue

        role     = canonical_role(player_type)
        category = role  # category mirrors role (drives auction queue ordering)

        # base_price: stored as integer points (baseBid × 1000)
        base_bid_float = to_num(base_bid, 4)
        base_price = int(round(base_bid_float * 1000)) if base_bid_float else 500

        profile_url = first_url(profile_url_raw)
        approved    = str(is_approved).strip().lower() in ("yes", "true", "1") if is_approved else False
        status      = "approved" if approved else "registered"

        player = {
            "auction_id":    auction_id,
            "player_no":     to_int(player_no),
            "name":          name,
            "photo_url":     str(photo_url).strip() if photo_url else None,
            "role":          role,
            "category":      category,
            "batting_style": str(spec1).strip() if spec1 and str(spec1).strip() else None,
            "bowling_style": str(spec2).strip() if spec2 and str(spec2).strip() else None,
            "base_price":    base_price,
            "profile_url":   profile_url,
            "status":        status,
            # Stats — keep keys consistent across all rows (PostgREST requirement)
            "matches":       to_int(stat_matches),
            "runs":          to_int(stat_runs),
            "bat_avg":       to_num(stat_bat_avg),
            "strike_rate":   to_num(stat_bat_sr),
            "wickets":       to_int(stat_wickets),
            "bowl_avg":      to_num(stat_bowl_avg),
            "economy":       to_num(stat_economy),
            "catches":       None,   # not in spreadsheet; included for key consistency
        }
        players.append(player)

    print(f"  {len(players)} players parsed, {len(skipped)} skipped.")
    for s in skipped:
        print(f"  ⚠  {s}")

    # 4. Insert in batches of 20 (PostgREST default max row limit)
    BATCH = 20
    inserted = 0
    for start in range(0, len(players), BATCH):
        batch = players[start:start + BATCH]
        result = api("POST", "players", batch)
        inserted += len(result)
        print(f"  Inserted rows {start+1}–{start+len(batch)} ({len(result)} confirmed).")

    print(f"\n✅  Upload complete — {inserted} players inserted into '{auction['name']}'.")


# urllib.parse needed for URL quoting
import urllib.parse

if __name__ == "__main__":
    main()
