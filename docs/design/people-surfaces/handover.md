# Handover: people surfaces inventory (read-only audit, no PR)

Branch `claude/people-surfaces-inventory`, off `main` at 03f37b4. Ticket dt_1e8a93bad026. Head sha: see the last commit on the branch (a doc cannot contain its own sha).

## Covered
`inventory.md` (counts, picks, surface table, 16 problems), `index.html` (phone-width gallery), `shots/` (46 PNGs, 390x844 full page, production build against prod data), `shoot.mjs` (throwaway screenshot script).
Surfaces shot: /dancers, /dancers/:id, /djs, /djs/:id, /teachers (+detail), /organisers (+detail), /videographers, /all-profiles, /people/:id, /search, /city/:slug/search, event pages, /festivals, home, /tonight, /classes.

## Not covered
- **Photos:** the image host (r2.dev) is blocked in the sandbox, so no real photo renders; the teal card and gold vinyl were seen only with fallbacks.
- **Flags:** teachersDirectory / teacherDetail / organisersDirectory / organiserDetail default off. Live Vercel values are unknown (live site unreachable), so both builds were shot (`FLAGSON-*` = flags on).
- **Multi-person lineup:** the three largest lineups are on non-public series (404 to anon), so none could be shot. Festival detail pages were not shot.
- **Shapes not found:** a rich dancer with bio + photo + gallery together (none exist); a dancer with `show_contact_publicly` on (0 exist); organiser phone/email toggles not exercised beyond one org.
- Event lineup chip links, organiser team-card links and /all-profiles were not checked in depth. Phone QA / CI not run (no PR).

## Verified / Not verified
Verified: counts (live SELECTs, and public RPCs `list_public_djs_v1`, `get_profile_event_timeline_v2`, `get_public_teachers_list_v1`); every shot is of a prod build served locally with prod data; `/people/:id` 404; teacher-only 404 with flags on; teacher RPC body has no `show_*` check (read from `pg_get_functiondef`).
Not verified: what Vercel prod flags are; real photos; whether the teacher RPC leak is reachable by a live user (RPC itself is anon-callable, page flag aside); the dancer page contact-toggle code path beyond one sample.

## Next steps
Owner decisions: the teacher-detail phone/email exposure; a real `/people/:id` route; what a person with 3 roles shows.
