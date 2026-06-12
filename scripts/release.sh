#!/usr/bin/env bash
# Manual release script. Run this from the repo root.
# Steps: DB migrations → build → deploy to Netlify.
# Each step must succeed before the next runs (set -e).
set -euo pipefail

echo "=== Cricket Auction release ==="

# 1) Push pending migrations — interactive, NO auto-confirm.
echo ""
echo "Step 1/3: Applying pending Supabase migrations..."
npx supabase db push

# 2) Build the frontend.
echo ""
echo "Step 2/3: Building frontend..."
npm run build

# 3) Deploy to Netlify.
echo ""
echo "Step 3/3: Deploying to Netlify production..."
npx netlify deploy --prod --dir=dist

echo ""
echo "Release complete."
