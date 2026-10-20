# S2b person-page-web handover

Branch `claude/person-page-web`. Brief: `docs/briefs/search-v7/S2b-person-page-web.md` (brief branch `brief/search-v7-2026-10-20`).

## Done
- `/people/:id` framework route (`app/routes/people.tsx`, registered in `app/routes.ts`): loader runs the SAME public reads as the old pages, 404 + noindex for unknown/archived ids, `noindex,nofollow`, canonical = strongest role page (teacher, else dj, else dancer), title/description use the (privacy-masked) name, tagged with `stampDancer`. Not in the sitemap.
- Page `src/modules/person-page/PersonPage.tsx`: back (44px), round photo, name once (only h1), role chips, city + Instagram, tabs Teaching / DJ / Dancing in that order (single role = no tab bar), tab in the URL hash (`#teaching`, `#dj`, `#dancing`), "Open full teacher/DJ/dancer page" under each tab.
- Tab bodies REUSE `TeacherProfile`, `DJProfile`, `DancerProfile` (no copied queries or render logic). They render "embedded" through `EmbeddedProfileContext` (`src/lib/embeddedProfile.ts`): `GlobalLayout` returns children only, `useCanonicalReplaceState` does not rewrite the URL, `DjHero` and the `DancerProfileGrid` identity tile drop the photo/name block (name shown once). Standalone pages are unchanged.
- Old role pages gain "Also: DJ . Dancer" (`AlsoRoles`) linking `/people/:id#...` (client-only, after mount, so SSR/hydration is untouched).
- Breadcrumb id `person.detail` added to `siteIa.ts`.
- Tests: `src/modules/person-page/__tests__/*` (roles x 11 shapes, tab order, single role, hash opens tab, hash for a missing role, click writes hash, links, tap targets, name once, hidden surname via masked read, archived/unknown -> null, teacher flag, Also row, embedded DjHero) and `app/routes/people.seo.test.ts` (noindex + canonical).

## OPEN ISSUE 1 (owner/DB decision): roles are INFERRED, not read
`person_roles` is RLS-locked for anon (no policy), and no public RPC returns a person's roles. No database change was allowed, so roles come from the old pages' own reads:
- Teaching = `get_public_teacher_detail_v1` returns a row AND `flags.teacherDetail` is on (off in prod today, so prod would show NO Teaching tab until the flag opens; the old teacher page is locked too).
- DJ = `get_public_dj_v1` returns a profile.
- Dancing = the dancer row has dancer content (years, styles, partner role, achievements), or the person has no other role. Every persona has a `dancing_role_details` row, so that row proves nothing.
Measured on prod (read-only): of 15 active people with an active `dancing` role, 6 have dancer content, 9 do not; of 68 without the role, 0 have dancer content. So no false Dancing tab, but Dancing is MISSED for dancers who are also teacher/DJ with an empty dancer section (e.g. `/people/chong` shows Teaching + DJ only although they hold dancing). Also `paola` (active teaching role) has no public teacher read (0 rows), so `/people/paola` shows a bare Dancer page; the old `/teachers/paola` 404s the same way.
Fix: an admin-repo migration adding `get_public_person_roles_v1(p_person_id uuid) returns text[]` (anon execute, active + public roles only), then replace `derivePersonRoles` input in `src/modules/person-page/reads.ts` with it (one place; tests are table-driven on `RoleSignals`). Search v7 already returns `roles` per person, so it could also pass them in.

## OPEN ISSUE 2: dancer tab ignores the v2 public page flag
Embedded dancer tab always renders the classic grid (the v2 page has its own h1/photo, so it would show the name twice). Decide whether v2 should get an embedded variant.

## Not changed on purpose
Old loaders keep their own copies of the dancer/DJ reads (same query keys and bodies as `reads.ts`); folding them onto the shared function is a follow-up (the brief allowed only the Also row on old pages).

## CI (run locally; billed runners may refuse)
| step | exit |
|---|---|
| `npm run typecheck` (97 errors, ZERO in touched files; baseline main has the same pre-existing errors) | non-zero, pre-existing |
| `npm run test:unit` | 17 failed / 9524 passed: `tests/eventViewCompat|occurrenceProgram|publicEventPageLineup.contract` need a live DB; `tests/integrityCouldNotRun` fails identically on main; `ProfilePage.test` timed out under load, passes alone; `imageWidths` was MINE (240px), fixed to 320 and passes |
| `npm run build` (with prod Supabase URL/key and teacher flag on) | 0 |
| check:rpc-typing, check:wallclock-brand, check:legacy-tables, check:legacy-program-rpcs, lint:architecture, check:bundle-budget, check:first-load-requests, check:chunk-cycles, check:dancer-area-isolation | all 0 |
Not run: check:images (AUDIT_STRICT), lighthouse, e2e-smoke, db-contract-check, lint chain, `/code-review`, pre-ship.

## Walk (production build, live prod data, read-only)
390x844, 360x640, 1280x800 on `chong` (2 inferred roles), `ricky-quinonez` (3 roles), `paola`, `bobby-blanco` (DJ only): no horizontal scroll, every tab/back/link target 44px high, one h1, hash switches tabs (#dj, #dancing). Chip text is rgba(255,255,255,.8) on a dark page (about 13:1 estimated; resolved bg read as black, not a measured gradient contrast). Screenshots: `docs/screenshots/person-page-web/`. A dancer-only person and long-name fixtures were NOT walked on prod (covered in unit tests only). Photo shows blank in the local screenshots (the local /_vercel/image emulation).
