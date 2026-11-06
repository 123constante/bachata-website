# Brief: P3 event page gets a "Share this event" row so an organiser can send the link

Brief-version: 2
Repo: Website. Branch: claude/p3-share-event-link. Lane: normal, Sonnet. No database call added. Design Gate applies (new visible row).

## What main lacks
- The P3 event page has "See it as dancers see it" (src/modules/organiser/p3/screens/EventPage.tsx `DancerView`, line 146, rendered first in `EditRows`, line 184) but no way to copy or share the event link. The only copy/share in P3 is the organiser PAGE link after go-live (src/modules/organiser/p3/onboarding/OnboardingFlow.tsx lines 998-1006). Walk D risk 8 (docs/handover/walk-dancer-view-after-edit.md): after publishing, an organiser with 10 dancers to tell has to open the public page and use the browser share by hand -- grep: p3-share-event-link
- The address is already computed: `publicPageOf(ws)` (src/modules/organiser/p3/data/eventPage.ts line 407) returns `{href, why}`; href is null for draft/archived/no slug. Reuse it; do not build a second rule.

## Files
src/modules/organiser/p3/screens/EventPage.tsx (one new `ShareRow` beside `DancerView`), src/modules/organiser/p3/data/eventPage.ts (only a pure `shareOf(ws, origin)` next to `publicPageOf`), src/modules/organiser/p3/screens/__tests__/shareEvent.matrix.test.tsx (new), docs/design/p3-share-event-link/INVENTORY.md and docs/design/p3-share-event-link.md. Overlap note: PR claude/p3-different-on-n-dates edits the Details and Prices screens, not EventPage.tsx; if you find it does, rebase after it merges and say so. Leave alone: p3/onboarding/**, p3/theme tokens (reuse `p3-row`).

## What to build
1. INVENTORY first (admin: none; current Website: the OnboardingFlow share at lines 998-1006 and TeamSheet.tsx lines 50-65; public page: the dancers' share sheet BentoPage `shareTitle`), file:line, then the design record with ONE chosen look: a `p3-row` under the dancer-view row, title "Share this event", subline "Send dancers the link", same 44px row height. Two rejected looks, two lines each.
2. `shareOf(ws, origin)`: `{url, title}` when `publicPageOf(ws).href` is set (url = origin + href, title = event name), else `{off:true, why: publicPageOf(ws).why}`. Off rows render disabled with that reason, never hidden.
3. Tap: `navigator.share({title, url})` when available, else `navigator.clipboard.writeText(url)` and the toast/note "Link copied."; a closed share sheet (AbortError) says nothing; a clipboard failure says "Couldn't copy. Press and hold the link below to copy it." and shows the url as selectable text.
4. Table test, RED FIRST: lifecycle {draft, live, paused, ended, archived} x slug {present, absent} x capability {share ok, share aborts, clipboard only, clipboard rejects, neither} -> row state (enabled/disabled+reason), message, and exact url (no tracking params, slug path from eventHref). Assert no row text points at a control that is not on screen.

## Out of scope
No analytics, no QR, no WhatsApp-specific button, no change to the dancer-side share. Walk the P3 event page at 390x844 for a live, a paused and a draft event on prod-shaped data (screenshots attached to the PR).
Hand-off: Verified / Not verified block; design record and screenshots linked in the PR body.
