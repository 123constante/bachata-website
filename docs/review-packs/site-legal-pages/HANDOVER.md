# Handover: owner values in /terms and /privacy (claude/site-legal-pages, PR #762)

Earlier handover (data categories, text ahead of product): `docs/handover/site-legal-pages.md`.

## What changed
- `src/pages/legal/LegalShell.tsx`: contact block now says "This site is operated by Bachata Calendar." No postal address (owner: skip). E-mail is a `mailto:support@bachatacalendar.co.uk` link; Instagram kept as an optional second channel.
- `src/pages/__tests__/LegalPages.test.tsx`: the pinned-count test is replaced by (a) no placeholder in the three sources, (b) on both /terms and /privacy: no placeholder text, "Bachata Calendar" present, no "postal address", the mailto link present. The placeholder string is built from two halves so `git grep "OWNER:" src` is clean.
- Shots (production build, 390x844, full page): `terms-390x844.png`, `privacy-390x844.png` in this folder.

## Red first
On head f3ec01f the new tests failed 3/8: `expected 'Privacy...' not to contain '[OWNER:'` (Privacy, Terms, sources). After: 8/8 pass.

## Per-job table
| Step | Command | Exit | Result |
|---|---|---|---|
| Placeholder grep | `git grep "OWNER:" -- src` | 0 | only the unrelated `OWNER` const in PublicClaimCard.intent.test.tsx |
| Legal test | `npx vitest run src/pages/__tests__/LegalPages.test.tsx src/lib` | 0 | 852 pass, 1 skipped |
| Types | `npx tsc --noEmit` | 0 | pass |
| ESLint (touched files) | `npx eslint src/pages/legal src/pages/Privacy.tsx src/pages/Terms.tsx src/pages/__tests__/LegalPages.test.tsx` | 0 | clean |
| Build | `npm run build` | 0 | built |
| Prod walk | `node scripts/_serve-build.mjs` + Playwright 390x844 | - | /terms, /privacy HTTP 200, no `[OWNER`, mailto count 1, scrollWidth 390 |
| Unit (all) | `npm run test:unit` | 1 | 15 fail in 4 files, none touch this change: `tests/eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract` (live-DB contracts), `integrityCouldNotRun` (sandbox) |

## Verified / Not verified
Verified: placeholders gone, name and mailto render on both pages in a production build; tests; tsc; build; 390x844 shots.
Not verified: GitHub Actions on this push, full `npm run lint` chain and `pre-ship`, the 4 failing unit files against clean main, a real phone, the legal wording, the Vercel preview. Earlier flagged items (text ahead of the product, immediate-erase vs 30-day grace) are still open for the owner.
