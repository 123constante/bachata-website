# Handover: /privacy and /terms (claude/site-legal-pages)

## What changed
- NEW `src/pages/Privacy.tsx`, `src/pages/Terms.tsx`, `src/pages/legal/LegalShell.tsx` (shared frame + contact block).
- NEW `src/lib/legalVersions.ts`: `TERMS_VERSION`, `PRIVACY_VERSION` = `2026-10-15` (accept_terms_v1 format). `accept_terms_v1` NOT called.
- Routes: `AnimatedRoutes.tsx`, `catchallClientPaths.ts` (needed for a 200 on a direct hit), breadcrumbs `privacy`/`terms` in `siteIa.ts`.
- Footer: Privacy + Terms links under "Connect" in `src/lib/contactLinks.tsx` (FooterLinks lives there; `components/layout/FooterLinks.tsx` is a re-export, see the note in that module).
- `navigateTargetsRoutable.test.ts`: removed the `RaffleEntryDialog -> /privacy` known-unroutable entry (now routable; the test demands it).
- NEW test `src/pages/__tests__/LegalPages.test.tsx`. Screenshots in `docs/handover/legal-shots/`.
- Not done: sign-up/onboarding agreement line (consent recording is release 1b); sitemap entries (left for the owner to decide).

## Owner must fill (3 `[OWNER:` placeholders, all in LegalShell.tsx)
1. Legal name of the person/company running the site.
2. Postal address.
3. Contact e-mail address (none exists in the code; the Instagram link is used meanwhile).

## Data categories found (code / database)
| Category | Where |
|---|---|
| E-mail, sign-in | Supabase auth; session in localStorage (`src/integrations/supabase/client.ts`) |
| Profile fields, photo, WhatsApp, surname/WhatsApp switches | `dancer_profiles` (first_name, surname, display_name, based_city_id, avatar_url, dance_role, nationality, languages, bio, instagram, facebook, website_url, whatsapp, show_whatsapp_publicly, hide_surname_publicly, is_active) |
| Profile views | `profile_view_events` (person_id, profile_type, source_context, viewer_session_id, user_agent, viewed_at) via `record_profile_view_v1` |
| Nights going/interested, level ratings | `set_attendance`, `set_my_occurrence_attendance_p5_v1`, `rate_series_level_p5_v1` |
| Rate limits | `member_action_attempts` (user_id, action, created_at); the 30-day retention is the brief's figure, not verified in the DB |
| Error reports | `report_client_error_v1` (scrubbed, `src/lib/clientErrorReporter.ts`) |
| Browser storage | localStorage: supabase session, `activeCitySlug`, `auth_last_email`, `auth_pending_return_to`, profile-entry role keys. No cookies set by app code; no third-party analytics script (Sentry SDK removed 2026-09-13; dataLayer pushes have no consumer in index.html/CSP) |
| Download / delete | `my_account_export_v1`; `/account/settings` (also Options in the dancer area) |

## Text that runs AHEAD of the product (confirm before merge)
- Feedback messages, feature-interest sign-ups, photo flags, consent records: NO table exists in prod today (survey 2026-10-15). The Privacy text describes them as if live; they are release 1b/A2.
- Delete: today `eraseAccount` calls the `account-erase` edge function and erases IMMEDIATELY (typed DELETE). The page says request, 30-day grace, cancel link (owner brief). Merge only once that flow exists, or edit the paragraph.

## Red-first
`LegalPages.test.tsx` before the change: `Error: Failed to resolve import "@/pages/Privacy" from "src/pages/__tests__/LegalPages.test.tsx"`. After: 6/6 pass.

## Per-gate table
| Gate | Command | Exit | Result |
|---|---|---|---|
| Types | `npx tsc --noEmit` | 0 | pass |
| Lint chain | `npm run lint` | 1 | only link red: `check:integrity` (exec bit missing in sandbox, exit 126); all other links PASS |
| Integrity | `bash bin/check-integrity.sh` | 0 | ok, 0 issues |
| Unit | `npm run test:unit` | 1 | 16 fail in 5 files (below); rest pass |
| Build | `npm run build` | 0 | built |
| Walk | Playwright 390x844 on `react-router dev` | - | both h1 render, scrollWidth 390 |

Failing unit files, none about this change: `tests/eventViewCompat.contract.test.ts`, `tests/latestEvents.contract.test.ts` (live-DB contracts), `tests/integrityCouldNotRun.test.ts` (sandbox), plus 1 more not inspected. `navigateTargetsRoutable` failed because of my change and is fixed. Not compared against a clean `main` run.

## Verified / Not verified
Verified: heading/footer/route/placeholder tests; tsc; build; 390x844 screenshots (dev server).
Not verified: production server (SSR of the catchall page), GitHub Actions, the uninspected failing unit files on main, real phone, the legal wording (owner to read).
