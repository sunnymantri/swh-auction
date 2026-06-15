-- Add grounds (list of venue names) and generated season schedule to auctions
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS grounds jsonb DEFAULT '[]'::jsonb;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS season_schedule jsonb DEFAULT '[]'::jsonb;
