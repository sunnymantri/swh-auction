# Security Incident Runbook (Leaked Keys)

## 1) Immediate containment
- Rotate `service_role` key in Supabase dashboard.
- Rotate any exposed third-party keys (for example CricHeroes).
- Update runtime secrets in all environments before restarting app traffic.

## 2) Environment update checklist
- Local `.env.local` and shell exports.
- Netlify environment variables.
- Supabase Edge Function secrets.
- Any CI/CD secret stores.

## 3) Verification checklist
- `admin-create-user` and `admin-reset-password` still work with new service-role key.
- `fetch-cricheroes` succeeds with updated third-party key.
- Frontend app boots with updated `VITE_` variables.
- No old key appears in logs or deployment output.

## 4) Git history hygiene
1. Rotate secrets first (mandatory).
2. Rewrite git history for leaked material:
   - Use `git filter-repo` or BFG to purge leaked tokens.
3. Verify with ripgrep that leaked tokens are absent.
4. Force-push rewritten history only with explicit team approval.

## 5) Post-incident hardening
- Enforce environment-only secret loading in scripts/functions.
- Keep `.env*` ignored.
- Add pre-commit secret scanning if available.
- Track a follow-up retro item with root cause and prevention actions.
