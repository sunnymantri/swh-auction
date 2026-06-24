-- Populate the SWH Challenger Cup season schedule.
--
-- The schedule lives in auctions.season_schedule (jsonb), one entry per round:
--   { round, label, date, matches: [{ home, away, venue, umpire, division? }] }
-- 11 rounds: Rounds 1-10 have 4 games each, the Final has 2. This adds the
-- `umpire` field per match (new). From Round 8 onward games are split across
-- Div 1 / Div 2, carried on an optional per-match `division` field (the games
-- stay in the same round). Dates are the match Sundays Jul–Sep 2026.
--
-- Matched by auction name so this is a no-op on environments without it.

update public.auctions
set season_schedule = '[
  {
    "round": 1, "label": "Round 1", "date": "2026-07-05",
    "matches": [
      { "home": "SWH Spartans",      "away": "SWH Mavericks",    "venue": "Clarke Reserve",  "umpire": "Syed Hussein" },
      { "home": "Sydney Bulls",      "away": "SWH Titans",       "venue": "Victoria Park",  "umpire": "Surshant" },
      { "home": "SWH South Hitters", "away": "Boundary Bashers", "venue": "Raby Pitch 5",   "umpire": "Derek" },
      { "home": "SWH West Hitters",  "away": "Boundary Smashers","venue": "Raby Pitch 6",   "umpire": "Barry" }
    ]
  },
  {
    "round": 2, "label": "Round 2", "date": "2026-07-12",
    "matches": [
      { "home": "Boundary Smashers", "away": "SWH Titans",       "venue": "Clarke Reserve",  "umpire": "Syed Hussein" },
      { "home": "SWH West Hitters",  "away": "SWH Mavericks",    "venue": "Raby Pitch 5",   "umpire": "Derek" },
      { "home": "SWH South Hitters", "away": "SWH Spartans",     "venue": "Victoria Park",  "umpire": "Surshant" },
      { "home": "Sydney Bulls",      "away": "Boundary Bashers", "venue": "Raby Pitch 6",   "umpire": "Barry" }
    ]
  },
  {
    "round": 3, "label": "Round 3", "date": "2026-07-19",
    "matches": [
      { "home": "SWH West Hitters",  "away": "SWH South Hitters","venue": "Clarke Reserve",  "umpire": "Syed Hussein" },
      { "home": "Boundary Smashers", "away": "SWH Mavericks",    "venue": "Victoria Park",  "umpire": "Surshant" },
      { "home": "SWH Titans",        "away": "Boundary Bashers", "venue": "Raby Pitch 6",   "umpire": "Barry" },
      { "home": "Sydney Bulls",      "away": "SWH Spartans",     "venue": "Raby Pitch 5",   "umpire": "Derek" }
    ]
  },
  {
    "round": 4, "label": "Round 4", "date": "2026-07-26",
    "matches": [
      { "home": "Boundary Bashers",  "away": "SWH Spartans",     "venue": "Clarke Reserve",  "umpire": "Syed Hussein" },
      { "home": "Boundary Smashers", "away": "SWH South Hitters","venue": "Victoria Park",  "umpire": "Surshant" },
      { "home": "Sydney Bulls",      "away": "SWH West Hitters", "venue": "Raby Pitch 6",   "umpire": "Barry" },
      { "home": "SWH Titans",        "away": "SWH Mavericks",    "venue": "Raby Pitch 5",   "umpire": "Derek" }
    ]
  },
  {
    "round": 5, "label": "Round 5", "date": "2026-08-02",
    "matches": [
      { "home": "Boundary Bashers",  "away": "SWH West Hitters", "venue": "Victoria Park",  "umpire": "Surshant" },
      { "home": "SWH Titans",        "away": "SWH Spartans",     "venue": "Raby Pitch 5",   "umpire": "Derek" },
      { "home": "Boundary Smashers", "away": "Sydney Bulls",     "venue": "Clarke Reserve",  "umpire": "Syed Hussein" },
      { "home": "SWH Mavericks",     "away": "SWH South Hitters","venue": "Raby Pitch 6",   "umpire": "Barry" }
    ]
  },
  {
    "round": 6, "label": "Round 6", "date": "2026-08-09",
    "matches": [
      { "home": "SWH Spartans",      "away": "SWH West Hitters", "venue": "Victoria Park",  "umpire": "Surshant" },
      { "home": "SWH Mavericks",     "away": "Sydney Bulls",     "venue": "Clarke Reserve",  "umpire": "Syed Hussein" },
      { "home": "SWH South Hitters", "away": "SWH Titans",       "venue": "Raby Pitch 6",   "umpire": "Barry" },
      { "home": "Boundary Bashers",  "away": "Boundary Smashers","venue": "Raby Pitch 5",   "umpire": "Derek" }
    ]
  },
  {
    "round": 7, "label": "Round 7", "date": "2026-08-16",
    "matches": [
      { "home": "SWH Mavericks",     "away": "Boundary Bashers", "venue": "Victoria Park",  "umpire": "Surshant" },
      { "home": "SWH Titans",        "away": "SWH West Hitters", "venue": "Clarke Reserve",  "umpire": "Syed Hussein" },
      { "home": "SWH Spartans",      "away": "Boundary Smashers","venue": "Raby Pitch 6",   "umpire": "Barry" },
      { "home": "SWH South Hitters", "away": "Sydney Bulls",     "venue": "Raby Pitch 5",   "umpire": "Derek" }
    ]
  },
  {
    "round": 8, "label": "Round 8", "date": "2026-08-23",
    "matches": [
      { "home": "Rank 2", "away": "Rank 1", "venue": "Raby Pitch 5",  "umpire": "Derek",        "division": "Div 1" },
      { "home": "Rank 4", "away": "Rank 3", "venue": "Raby Pitch 6",  "umpire": "Barry",        "division": "Div 1" },
      { "home": "Rank 6", "away": "Rank 5", "venue": "Clarke Reserve","umpire": "Syed Hussein", "division": "Div 2" },
      { "home": "Rank 8", "away": "Rank 7", "venue": "Victoria Park", "umpire": "Surshant",     "division": "Div 2" }
    ]
  },
  {
    "round": 9, "label": "Round 9", "date": "2026-08-30",
    "matches": [
      { "home": "Rank 3", "away": "Rank 1", "venue": "Clarke Reserve","umpire": "Syed Hussein", "division": "Div 1" },
      { "home": "Rank 4", "away": "Rank 2", "venue": "Victoria Park", "umpire": "Surshant",     "division": "Div 1" },
      { "home": "Rank 7", "away": "Rank 5", "venue": "Raby Pitch 5",  "umpire": "Derek",        "division": "Div 2" },
      { "home": "Rank 8", "away": "Rank 6", "venue": "Raby Pitch 6",  "umpire": "Barry",        "division": "Div 2" }
    ]
  },
  {
    "round": 10, "label": "Round 10", "date": "2026-09-06",
    "matches": [
      { "home": "Rank 4", "away": "Rank 1", "venue": "Victoria Park", "umpire": "Surshant",     "division": "Div 1" },
      { "home": "Rank 3", "away": "Rank 2", "venue": "Clarke Reserve","umpire": "Syed Hussein", "division": "Div 1" },
      { "home": "Rank 8", "away": "Rank 5", "venue": "Raby Pitch 6",  "umpire": "Barry",        "division": "Div 2" },
      { "home": "Rank 7", "away": "Rank 6", "venue": "Raby Pitch 5",  "umpire": "Derek",        "division": "Div 2" }
    ]
  },
  {
    "round": 11, "label": "Final", "date": "2026-09-13",
    "matches": [
      { "home": "Second Ranked Team in Div 1", "away": "Top Ranked in Div1", "venue": "Raby Pitch 5", "umpire": "Derek", "division": "Div 1" },
      { "home": "Second Ranked Team in Div 2", "away": "Top Ranked in Div2", "venue": "Raby Pitch 6", "umpire": "Barry", "division": "Div 2" }
    ]
  }
]'::jsonb
where name = 'SWH Challenger Cup';
