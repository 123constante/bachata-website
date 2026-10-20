# W1 slice S4: calm graphite becomes the site's default background (Website, Sonnet)

Repo: Website (123constante/bachata-website). Branch: `claude/w1-s4-graphite`, created FROM `origin/main`. SUB-BRANCH of the W1 PR: push the branch, do NOT open a PR (the orchestrator merges it with S0-S3 locally).

## Why (owner decision 2026-10-20, picked from pictures)
Mockup round S13 (branch `claude/s13-site-background`, read `docs/handover/s13-site-background.md` and `src/components/layout/s13Background.tsx` there, plus its shots `docs/mockups/s13/B-*.png`) compared 3 options for every page on the `default` palette (the purple/amber/pink moving wash + 20 floating icons, 36+ pages). The owner picked **B, calm graphite**: `#0E1215` with a faint top light, NO floating icons, static (no animation), and the body ground filled so there is no black band above the footer. S13's findings it fixes: icons sitting over text (e.g. /faq 60,942 px² of icon over text), the dead black band under the fixed wash, the clash with the new role worlds, the constant 10s animation.

## Task (you own ONLY these files)
`src/components/layout/GlobalLayout.tsx`, a new `src/components/layout/pageGrounds.ts` (the palette constants), their tests, and the global CSS file only if the body ground must be set there (say which in the handover).
1. `gradientPalette='default'` renders option B exactly as S13 measured it (body rgb(14,18,21)), static, and renders NO floating icons regardless of `floatingCount`. Port B's values from `s13Background.tsx`; do NOT bring over the `?s13=` flag or options A and C (they exist only on the prototype branch; main must not gain them).
2. No black band: the page ground must cover the full document height including the strip above the footer on long pages (S13 finding 2). Measure it.
3. Add two palettes for the role pages, PINNED names (slices S1/S2 will pass them; do not change pages yourself): `'dancer'` = deep teal ground `#06191F`, and `'dj'` = near-black `#0A080B`. Both static, full bleed, no floating icons, no band. Values come from `claude/s12-mockups` `src/modules/person-page/mockups/S12Mock.tsx`; check them there.
4. `bento`, `velvet`, `brass`, `organiser` and pages with `showGradientBg=false` must render byte-for-byte as today. The progress bar is unchanged.
5. Out of scope: labels under 12px (a separate ticket), any page file.

## Proof
- Unit test (table): palette -> ground colour, icons rendered (0 for default/dancer/dj), animation absent; unchanged palettes still render their old element. Show it RED on main first (default currently renders icons + animation), then GREEN.
- PRODUCTION build (`npm run build`, then serve it) at 390x844 against the prod project with the public anon key (read-only): before/after PNGs of /parties, /faq, /dancers, /search?q=salsa, /classes and a 404 page -> `docs/mockups/w1-s4/<page>-{before,after}.png`. Measured per page: body background rgb, count of floating icons, px² of icon over text (0 expected), colour at the strip just above the footer after scrolling to the bottom, WCAG contrast of white/muted/amber text on the ground. Also shoot one unchanged page (/venues, brass) before/after to show no change.

## Gates (run ALL, per-job table with command + exit code in the handover)
Read `.github/workflows/*.yml` and run every job step your sandbox can run (lint, typecheck, unit tests, production build, any phone-size e2e you can run). A GitHub "payments have failed / spending limit" annotation is billing, not code; your table is the evidence. Docker / local Supabase / real phone: NOT RUN with the reason.

## Rules
- Plain git only (`git fetch`, `git show`, `git push`); NEVER `gh api`. Commands without variables, loops or `$(...)` where a plain command works. `NODE_OPTIONS=--max-old-space-size=3072` for the build if needed.
- Supabase READ-ONLY. Never touch `.github/workflows`, `.env*`, secrets.
- Push ONCE at the end (Vercel deploy cap). Last commit subject ends `[worker-done <ticket>]`.
- 30% context rule: at 25% start nothing new; by 30% push work + handover, last subject ending `PARTIAL [worker-done <ticket>]` (a continuation worker reads your handover; normal).
- Handover file: `docs/handover/w1-s4-graphite.md` (done / measured numbers / left / NOT verified).
- Never merge, approve, or open a PR. Stop after the push.

PR BATCHING (docs/pr-batching-policy.md, adapted: sub-branch, no PR)
- ONE branch for this job. Push ONCE when finished. Fix your own mistakes on this branch.
- UI change: follow docs/ui-quality-bar.md; the handover has a Phone QA section (viewports, measured overlap/contrast numbers, or NOT RUN with reason).
- Never merge or approve. Stop after the push and report.
