# Fix-red: dependabot website #723 #725 #726 (one class: dependency bumps)
Lane: normal, Sonnet. Repo bachata-website. Branch claude/fix-red-dependabot-723-725-726 (from main).
Goal: make each bump pass unit + build, or report why it cannot.
1. #723 supabase-js 2.117.2 -> 2.119.0: only contract-check red, and it is red on main too. Confirm unit/build/typecheck pass on the PR branch; no code change expected. Report only.
2. #725 web-vitals 5.3.0 -> 6.2.3: unit (Europe/London, full) red. Read the failing test, check v6 API changes (onFID removed, etc.), fix call sites minimally on your branch with the bump included.
3. #726 @vercel/node 13.0.2 -> 27.0.2 (dev dep, jump of 14 majors): unit red. Find what imports it (types only?). If the bump needs a real migration, do NOT force it: write findings and recommend ignore/pin via a dependabot ignore rule proposal in the handover.
Rules: no secrets, no merge, no --no-verify, no prod/DB writes. Push once coherent. PR body needs the exact "## Verified on real data" lines (Shapes surveyed / Checks run / NOT verified); no UI files so delete Phone QA. Handover: docs/briefs/fix-red-dependabot.handover.md with Verified / Not verified and tsc result.
