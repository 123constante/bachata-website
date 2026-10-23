# Brief: Going P3 -- organiser "who is going" as self-contained components (no page placement)

Model: Opus. Lane: careful. Branch `claude/going-p3-organiser`, created FROM `origin/claude/going-p2-website` (P2 builds `src/modules/going/`; reuse it, never copy it). One PR, base = main once P2 is merged (say in the PR body that it stacks on the P2 PR until then). Switch `GOING_CHECKIN_ENABLED` stays false.

## Agreed with the organiser-rebuild lane (2026-10-23, binding)
- Their rebuild (mockup C "Today first", C v2 at `claude/er-p3-mock-c2:docs/organiser-rebuild/p3/mockups/C2.html`) will mount our components later in three per-night slots: Home "Next up" hero line ("12 going", tap -> people), the event date-strip sheet row "Who's going (12)" -> list, and the Stats "By event" rows (count beside views). Match C2's look (read it with git show); no new colours.
- Do NOT touch `src/modules/organiser/**` or `OrganiserRoutes.tsx` (frozen; owned by the rebuild). No routing, no page placement. Everything lives in `src/modules/going/`.

## Build
1. `useMyEventGoing(publicEventId)` -- React Query wrapper of `get_my_event_going_v1(p_public_event_id uuid)` -> `{public_event_id, nights:[{occurrence_id, occurrence_date, starts_at_local, is_cancelled, going_count, people:[{dancer_profile_id|null, first_name, photo_url|null}]}]}` (upcoming nights only, cancelled included, up to 200 people). Refusals: `not_signed_in`, `not_found`, `not_organiser` -> each a state in P2's one mapping (`goingState.ts` or its organiser section), with words + what to do.
2. `<GoingNightSummary night={...} variant="compact" />` -- count line only ("12 going"; tap target >= 44 px explicit px; `onOpen` callback prop, no navigation of its own).
3. `<GoingPeopleSheet night={...} />` -- full list: first names; photo only when `photo_url` set (else initials circle, reuse P2's `GoingPeople` parts); link to the dancer page only when `dancer_profile_id` is non-null.
4. Props take the night object exactly as the RPC returns it.
5. States in words, from the shared copy file: 0 going = "Nobody has said they&rsquo;re going yet"; error = "Couldn&rsquo;t load who&rsquo;s going. Try again" with a retry button; loading; cancelled night = "This date is cancelled" (never "0 going"); 200 people list scrolls inside the sheet. `starts_at_local` is London wall clock with no zone: render as-is, never `new Date()` it. Full weekday names. HTML entities in JSX.
6. A small dev-only story/demo page is NOT wanted; instead a test harness renders each component in each state for screenshots.

## Design Gate 3-4 + verification
Tokens from DESIGN.md / C2 only. Design record `docs/design/<pr>.md`. Stage 4 checks (contrast >= 4.5, taps >= 44 px, no clipping, no sideways scroll at 390). Shape survey (read-only, counts only): organisers' upcoming nights x going 0/1/9+/cancelled. Table-driven vitest: every component x every state x every shape. 390x844 screenshots of every state in `docs/handover/going-p3/` for the critique worker. Run every CI job step that applies; per-job table + Verified / Not verified in the PR body. Handover `docs/handovers/going-p3-organiser.md` including the exact props for the organiser lane to mount.
