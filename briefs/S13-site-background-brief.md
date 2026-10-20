# S13: site-wide background design review + 3 options as mockups (Website, prototype, NO PR)

Repo: bachata-website. Branch `claude/s13-site-background` off `claude/s12-mockups` (it has the S12 mock route and role backgrounds). Sonnet. Read and push with PLAIN git (never `gh api`). Commands without variables/loops/`$(...)` where a plain command works. Supabase READ-ONLY (anon reads via the site are fine). Never merge, approve or open a PR. Never `--no-verify`. Check a PRODUCTION build (`npm run build` with the mocks flag, then serve the build), not only the dev server. If memory runs out, use `NODE_OPTIONS=--max-old-space-size=3072`. ONE push at the end (Vercel deploy cap); final commit subject ends `[worker-done <ticket>]`. 30% context rule: at 25% start nothing new; by 30% push + handover `docs/handover/s13-site-background.md` (done / left / exact next steps), subject ending `PARTIAL [worker-done <ticket>]`. A continuation worker is normal and reads that handover.

## Why (owner's words)
After seeing the S12 people mockups the owner said: "there is many more page with the purple background, check. Should we use the claude frontend designer?" Owner chose: review ALL purple pages with the frontend designer and come back with pictures of 2-3 options to pick from. The people build runs in parallel and does NOT wait for this. Nothing here goes live.

## Facts
- `src/components/layout/GlobalLayout.tsx`: `gradientPalette` = 'default' (festival-purple/pink wash + FloatingElements icons; comment says 36+ public pages depend on it) | 'bento' | 'velvet' | 'brass' | 'organiser'.
- Owner decisions already made (keep them in every option): dancer pages = dark teal background, DJ pages + /djs list = near-black with gold; floating icons OFF on role pages, ON elsewhere unless an option argues otherwise; site footer stays orange; vocabulary Dancer / DJ / Teacher.
- The owner is not technical and looks at pictures on a phone. Never ask UX questions; make the design calls and explain each in one plain sentence.

## Task
1. Inventory: every public route and which palette it renders with (route, page file, palette, icons on/off). Put the table in the handover.
2. Design review: if the `impeccable` skill is available, run its critique on 390x844 production-build screenshots of the default-palette pages (at least: home, /events or the main listing, a single event page, /venues, a venue page, /organisers, an organiser page, /dancers, search results, /faq). If it is not available, review against: one coherent colour system across the site (role worlds vs the general site), contrast >= 4.5:1 for body text, the icons not covering content (measure overlap with text boxes), no dead black band above the footer, legibility of small labels (>= 12px), and whether purple fits next to the teal/near-black role worlds. Write findings ranked most-important first.
3. Make THREE options, each applied to the same 6 pages via a mock flag or palette prop (no change to the default behaviour when the flag is off):
   - A: keep purple, refined (fix the review's findings only).
   - B: a calmer neutral dark base that sits well beside teal and near-black (your best pick of hue).
   - C: your boldest credible direction from the review.
   Shoot each at 390x844 against the production build: `docs/mockups/s13/<option>-<page>.png`, plus `docs/mockups/s13/today-<page>.png` for the current look. Use real prod data (anon reads), real names, real events.
4. Measure, do not guess: contrast ratios of body text on each base, icon/text overlap px, label sizes. Put numbers in the handover.
5. Handover `docs/handover/s13-site-background.md`: inventory table, ranked findings, the three options in plain words (2 lines each, which pages change), your recommendation with reason, measured numbers, Verified / Not verified.

Stop after the push. Report: branch head sha and the list of PNGs.
