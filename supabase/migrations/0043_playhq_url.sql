-- Add PlayHQ profile URL field to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS playhq_url text;
