feat(site): /privacy and /terms pages, footer links, version constants

## Summary
- Adds `/privacy` and `/terms` pages (shared `LegalShell`), footer links to both, and version constants for the legal text.
- Owner values filled in: operated by Bachata Calendar, no postal address, contact by `mailto:support@bachatacalendar.co.uk`, Instagram as an optional second channel.
- Deletion wording now matches the owner decision of 2026-10-15: deleting an account hides it from everyone at once; signing in within 30 days restores it; after 30 days it stays hidden and the data is kept; permanent erasure is by request (UK GDPR / GDPR Art. 17) at the contact address, done by hand with confirmation. No "erased for good" or fixed erase period remains. `PRIVACY_VERSION` and `TERMS_VERSION` bumped to 2026-10-16.
- Open for the owner: text ahead of the product (see `docs/handover/site-legal-pages.md`).

## Per-job table (run locally; GitHub billing annotations are not code failures)
| Job / step | Command | Exit | Result |
|---|---|---|---|
| dancer-area-isolation self-test | `node scripts/check-dancer-area-isolation.mjs --self-test` | 0 | 60 cases behave |
| dancer-area-isolation | `npm run check:dancer-area-isolation` | 0 | prints COULD NOT MEASURE (protected entries not on origin/main in this sandbox); not a pass |
| Legal tests | `npx vitest run src/pages/__tests__/LegalPages.test.tsx` (also TZ Europe/London, America/Los_Angeles, Pacific/Auckland) | 0 | 10/10 each; the 2 new tests were red on the old text |
| Typecheck | `npx tsc --noEmit` | 0 | 0 errors |
| ESLint (touched) | `npx eslint` on the 4 touched src files | 0 | clean |
| Unit (all) | `npm run test:unit` | 1 | 8071 pass, 15 fail in 4 files, none touch this change: `eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract` (live-DB) and `integrityCouldNotRun` (sandbox) |
| Production build | `npm run build` | 0 | built |
| PR-body checks | `check-pr-phone-qa.mjs`, `check-pr-real-data-verified.mjs` on this file | 0 | pass |

Not re-run this pass: full `npm run test:unit` (last full run: 15 failures in 4 files unrelated to this change, see HANDOVER).
Not run: `integrity` job (`check:images`), full `npm run lint` chain, `pre-ship`.

## Phone QA
- Sizes checked: 390x844 (production build; `privacy-deletion-390x844.png` shows the changed section, plus full-page shots in `docs/review-packs/site-legal-pages/`)
- Walked: `/terms` and `/privacy` served from the production build: HTTP 200, no placeholder text, one mailto link, scrollWidth 390 (no horizontal scroll); footer links to both pages.
- Not verified: a real phone, 360x640, the Vercel preview, and the phone suite (phone-qa.yml) on this push.

## Verified on real data
- Shapes surveyed: none needed (read-only, counts N/A). The pages are static text and read no database rows; no Supabase query was run.
- Checks run: the table above, plus the 390x844 production-build walk of both pages.
- NOT verified: GitHub Actions on this push, the four failing unit files against clean main, the legal wording itself (owner's), a real phone.

## Verified / Not verified
Verified: isolation check and self-test, legal tests, typecheck under baseline, production build, 390x844 walk, both PR-body checks.
Not verified: items listed under Not run and the Not verified lines above.
