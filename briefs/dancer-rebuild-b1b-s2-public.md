# S2 Public dancer page v2 (Website, branch claude/dancer-app-r1b-public from origin/main). Model: Opus.
Read dancer-rebuild-COMMON.md, dancer-rebuild-b1b-COMMON.md, PLAN section 6 seam 5 and W2f (portrait first).

## What and why (plain words)
The page other people see for a dancer (`/dancers/<slug>`) gets a portrait-first layout with a Share button, bio, languages and
(only when the dancer chose to show it and has another profile type) a WhatsApp button, plus a "Join" button for signed-out visitors.
Because the beta switch is ON in production, this goes live to everyone on merge, so the old page must lose NOTHING: keep EVERY
section the page shows today (inventory: `src/pages/DancerProfile.tsx`, `app/routes/dancers.tsx`,
`src/modules/profile/dancerPublicProfile.ts`; list each section old -> new in the handover).

## Do
1. New code under `src/modules/dancer-app/public-page/` (component `PublicDancerPageV2`, model, tests). Existing files you may change:
   `src/pages/DancerProfile.tsx`, `app/routes/dancers.tsx`, `src/modules/profile/dancerPublicProfile.ts` and their tests. Nothing else.
2. v2 renders only when the open flag is true (read it in the route loader so server HTML and first paint agree; no flash of the old
   page). When closed or the flag read fails => today's page byte-for-byte (snapshot test). `<head>`, JSON-LD, og tags, canonical and
   the noindex rule for nameless profiles stay IDENTICAL in both modes (test the generated head for every shape).
3. Data: existing public reads + `get_public_dancer_extras_v1`. WhatsApp only if the RPC returned it. Never show a hidden surname
   (reuse `publicDancerNames.ts`); paused/hidden/archived => the same not-found page as today.
4. Share: Web Share API with copy-link fallback and a visible confirmation. Join button: signed-out only; signs in, then returns here.
5. Views: keep the existing `profileViewEmit` call exactly once per visit; add no other recorder.
6. Shapes to test (table-driven, 390x844 and 200% text): photoless, long name, surname hidden, nameless, admin-made unclaimed,
   with/without bio, many languages, WhatsApp on/off, paused, signed-in vs signed-out viewer, flag open vs closed.
Boundaries: no PR, no merge; do not touch `api/`, `screens/`, `shell/`, RsvpBlock, FestivalHub. Stop after the push.
