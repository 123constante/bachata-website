# S1 Going lock (Website, branch claude/dancer-app-r1b-lock from origin/main). Model: Opus.
Read dancer-rebuild-COMMON.md, dancer-rebuild-b1b-COMMON.md, INTERFACE (section 5, gate contract), PLAN section 6 seam 6 and C14.

## What and why (plain words)
A person in the closed beta who has not finished their profile (strength under 70, i.e. `ProfileGateContext` says incomplete)
must not be able to press Going / Interested on an event. Today the server refuses them with `profile_incomplete` and the page
shows a confusing error. Make the button itself say why and give a working link: "Add your photo and a few details to say
you're going", using the next missing step from `src/modules/dancer-app/api/nextStep.ts`, linking to `/app/welcome`.
People NOT in the beta (and signed-out people) see today's pages exactly as now: a not-allowed snapshot test proves it.

## Do
1. `src/modules/dancer-app/gate/useGoingLock.ts`: `useGoingLock(): { locked: boolean; reason: string|null; href: string|null }`.
   Reads `useDancerArea()` + `ProfileGateContext` ONLY (no new request). Loading or error => `locked:false` (never block on doubt;
   the server still refuses). Organiser-type people: not locked.
2. Wire into `src/modules/event-page/bento/blocks/RsvpBlock.tsx` through the existing `closedReason` slot (both buttons already take
   `disabled={reason !== null}` and print the reason in `rsvp-meta`; add a small link element) and `src/pages/FestivalHub.tsx`
   (the `setAttendanceRpc` path, same hook). RsvpBlock is a lazy chunk and must NOT import from the event route chunk: import the hook
   inside the chunk and prove with the bundle report that the event-route first-load grows <= 0.5 KB gz.
3. The status READ keeps running when locked: an old RSVP still shows and can still be removed.
4. Update `RsvpBlockPlaceholder.tsx` + `tests/client/rsvpBlock.test.tsx` (mirror drift test).
5. Table-driven test: person state (signed-out, not allowed, allowed+complete, allowed+incomplete for each missing step, organiser,
   loading, error) x surface (event page block, festival hub) => same `locked/reason/href` on both (one mapping); the link target
   exists in the route table; no text points at a missing control.
6. Allowed files ONLY: the ones above, `gate/useGoingLock.ts`, `gate/__tests__/`, and `tests/regression/today` snapshots that must
   change (explain each). Nothing under `api/`, `screens/`, `shell/`.
Boundaries: no PR, no merge. Stop after the push.
