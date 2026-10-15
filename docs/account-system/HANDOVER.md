# Handover: account-system plan draft (ticket dt_675f03e2f76c)

**Branch.** `claude/account-system-plan`, branched from `claude/journey-matrix` @ 34877de. Docs only: nothing in
`src/`, `tests/` or `supabase/` changed, and no PR was opened, per the brief.

## Done (all five deliverables)

| File | What |
|---|---|
| `ACCOUNT-MODEL.md` | Entities, 9 state axes, 13 named states with prod counts, 25 transitions, the owner decisions O1-O8 with their status, 2 mermaid diagrams, and who may switch to what. Everything is marked BUILT, PARTIAL, NOT BUILT or CONFLICT with file:line |
| `JOURNEY-GRID.md` + `journey-grid.json` + `build_grid.py` | 84 rows with stable ids. Each row maps to its MATRIX id. The JSON is the source and the tables are generated from it. The proposed CI check (ratchet) is specified but not built |
| `GAPS.md` | 31 gaps across security, privacy, rollout, observability, a11y and deliverability, with severity, prod counts and fixes |
| `DECISIONS.md` | 12 click questions in 3 rounds of 4, each with the recommended option first |
| `PLAN.md` | PR-0 (#764) to PR-6, with worker slices that share no files, pinned interfaces, admin migrations flagged, the prod change per PR, and sizes |

## Findings the owner should see first

1. **CONFLICT with O4.** The admin repo's 30-day grace erase is deployed and live: the `account-erase-due`
   function, the daily cron, and RPCs callable by any signed-in user. It e-mails a cancel link to a Website
   route that does not exist. There are 0 rows so far. PLAN PR-2a retires it.
2. **The live sign-up hook is unknown (v1 or v2), and the dancer area flag is ON.** If v1 is live, every
   non-allowlisted sign-up is refused. Owner check: DECISIONS D9.
3. **Bot protection is off.** CAPTCHA is off and the blocked-domain list has 0 rows. The auth e-mail cap is
   recorded as 30 per hour, project-wide (unverified).
4. **`member_consents` has 0 rows**: no consent is recorded for anyone.
5. **30% of logins (6 of 20) never entered their code**, and no funnel event or error report would show it.
6. **The dancer invite e-mail links to `/join/<token>`**, but the Website has no such route (O6, PLAN PR-4).

## Not verified

- The dashboard-only Auth settings (hook, CAPTCHA, OTP expiry, rate limits, session timeout) cannot be read via
  SQL. The values quoted are from admin docs dated 2026-10-06 to 10-12.
- DMARC, SPF and DKIM were not re-read: there is no DNS tool. The values are from the admin audit doc.
- The `organiser-signup` "always refuses" claim was inferred from the code, not called.
- The analytics consent banner was not checked (G-P6).
- No test or walk was run for the grid. Its `covered_by` refs were taken from file and test names, and the 3
  `R:` titles were checked verbatim against `dancer-app-routing.build.spec.ts`.
- The prod state counts in ACCOUNT-MODEL reuse MATRIX's buckets (+-1 noise), refreshed with today's
  `profile_complete_v1` totals (18 with a dancer row, 10 complete).

## Next steps

1. The owner answers DECISIONS rounds 1-3.
2. After #764 merges, dispatch PR-1 (1a and 1b) and PR-2 (2a, 2b, 2c) in parallel.
3. Then dispatch PR-3 (3a, 3b, 3c), PR-4, PR-5 and PR-6, in that order (dependency graph in PLAN.md).
