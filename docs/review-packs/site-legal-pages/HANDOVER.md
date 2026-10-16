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

## Pass 2: deletion wording (brief pr762-privacy-deletion, owner decision 2026-10-15)
- `/privacy` "Download or delete your data": hidden from everyone at once; sign in within 30 days restores; after 30 days stays hidden, data kept, not erased automatically; permanent erasure on request (UK GDPR / GDPR Art. 17) at the contact address, done by hand with confirmation. New "How long we keep things" section. "Your rights" now says erase. Removed "30-day grace period", "cancel with the link we send you", "erased for good".
- `/terms` "Removing content and accounts": same facts in two sentences, points to Privacy.
- `src/lib/legalVersions.ts`: both versions bumped to `2026-10-16`.
- Tests: two new cases in `LegalPages.test.tsx`. Red on the unfixed text: Privacy `expected '...' to contain 'hidden from everyone at once'`; Terms `expected '...' to contain '30 days'` (2 failed, 8 passed). After: 10/10, also in 3 timezones.
- Shot: `privacy-deletion-390x844.png` (changed section); `privacy-390x844.png` refreshed (full page, production build, scrollWidth 390).

| Step | Command | Exit |
|---|---|---|
| Legal tests | `npx vitest run src/pages/__tests__/LegalPages.test.tsx` (default TZ, Europe/London, America/Los_Angeles, Pacific/Auckland) | 0 x4 |
| Types | `npx tsc --noEmit` | 0 (0 errors) |
| ESLint touched | `npx eslint` Privacy, Terms, test, legalVersions | 0 |
| Build | `npm run build` | 0 |
| Isolation | `npm run check:dancer-area-isolation` | 0, but output "COULD NOT MEASURE" (sandbox lacks the protected files on origin/main) |

Not verified: GitHub Actions, full unit run, `integrity`/`check:images`, full lint chain, `pre-ship`, phone-qa suite, a real phone, whether the product actually restores on sign-in within 30 days (copy states the owner decision; the backend is not checked here), legal sign-off. PR-body checks: `check-pr-phone-qa.mjs` and `check-pr-real-data-verified.mjs` both exit 0 on PR-BODY.md.
