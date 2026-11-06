# Arc: Bristol launch (ambassador shared link, empty-city polish, activation)

Last verified: 2026-11-06 against Website origin/main a8c7b7d00 and admin origin/main 514fb0ab, with `gh pr view` and `git show origin/brief/...`. Sources: plans/PLAN-bristol-launch.md (facts, owner answers 2026-10-26 and 2026-10-29), READY-QUEUE.md rows 54, 69, 70, 71. `W#` = bachata-website, `A#` = bachata-admin.
Goal: one Bristol ambassador (Jan) sends one permanent link; organisers and people join with Bristol as their city and build up hidden while `cities.is_active` for `bristol-gb` stays false; the owner says go and ONE UPDATE activates it. Never INSERT cities; activation is an owner-named prod write, read-before/show-after, logged.

## Slices
| Slice | Repo | Status | Blocked by | PR / branch / brief |
|---|---|---|---|---|
| Bristol audit (option A safe) | web | DONE | -- | W#1055 (docs PR still open, content read) |
| Polish: city-aware copy, empty-city note, teacher "Tell us" variant, map centre, venues per city | web | DONE | -- | W#1056 |
| Calendar empty copy ("Coming soon" + Tell us) in the density-excluded files, owner OK 2026-10-26 | web | DONE | -- | W#1134 |
| Ambassador moderation + review only in ambassador cities | admin | DONE | -- | A#1085, A#1091 |
| Ambassador audit (existing gate, invite plumbing) | web | DONE | -- | W#1140 |
| Shared link DB: one permanent link per ambassador, join tracking, landing/tracker/badge reads, on/off | admin | PR OPEN since 2026-11-06, labels `run-ci,ap:stopped`; red: unit-build, rpc-body-snapshots; no independent review yet | fix round, independent review (migration), replay proof, apply, owner Approve | A#1277 claude/bristol-ambassador-link-admin (dfc8a80e) |
| Landing page `/join/a/:code` ("Jan invited you to Bristol") | web | BRIEFED, not dispatched | A#1277 applied on prod | brief/bristol-ambassador-landing (ea1b7faf) |
| Ambassador tracker (invited / joined / set Bristol; visible to ambassador + owner) | web | BRIEFED, not dispatched | A#1277 applied | brief/bristol-ambassador-tracker (28bbde03) |
| Ambassador badge on profile | web | BRIEFED, not dispatched | A#1277 applied AND owner call on anon access | brief/bristol-ambassador-badge (d479eff3) |
| Activation of `bristol-gb` (one UPDATE) | prod data | NOT STARTED | Jan has an account and joined; real set of Bristol people; owner says go | PLAN-bristol-launch.md step E |

## Slices not yet briefed (drafters: verify each on origin/main first)
| Item | Repo | Blocked by | Source |
|---|---|---|---|
| Badge next to the ambassador's name on events they approve (approve audit row not exposed) | admin then web | owner scope call; badge slice first | badge brief "OUT OF SCOPE" line |
| Ambassador approve-in-one-tap for pages and events in own city, rejection reasons from a list, 3-day escalation to owner | both | A#1277 applied; confirm what A#1085/A#1091 already cover | PLAN 2026-10-29 owner clicks |
| Homepage city detection from connection (Vercel edge headers), nearest ACTIVE city within ~60 km else choose-your-city, "Not right? Switch" line, crawlers get London | web | activation date nearer; owner wants it before launch | PLAN 2026-10-29 ~17:25Z |
| Teacher "Tell us" City line / Teacher label in the email to the owner (queued for later) | admin | none | PLAN round 3 |
| Dancer `/join` route (missing per audit) | web | landing page decision (does the link cover dancers, teachers, DJs?) | PLAN audit summary; link audience question open |
| Post-activation prod verify list (teachers page, switcher, sitemap, Googlebot, London pages unchanged) | ops | activation | PLAN step F |

## Owner decisions pending
- Badge: may a signed-out visitor see the badge (anon grant on `is_city_ambassador_public_v1`) or signed-in only? Blocks the badge slice.
- Who the shared link may bring in beyond organisers (teachers, DJs, dancers): asked 2026-10-29, skipped, still open.
- Launch date and the activation go (single UPDATE), after Jan's account and the first organisers exist. Jan had NO auth account when last checked (2026-10-26); not re-checked.
- Decided and closed: option A (activate early, empty pages cope), scope Bristol only, empty-city copy "Coming soon + Tell us", Tell-us goes to the owner, one ambassador per city, link permanent and switch-off-able, London festival label left alone.

## Rules for briefs in this arc
- Website slices that read ambassador RPCs must be dispatched only after the admin migration is APPLIED on prod (workers otherwise build against mocks).
- Bristol is inactive: walk with the stored city `activeCitySlug=bristol-gb` on bare routes, since `/city/bristol-gb/*` 404s while inactive.
- Shapes: Bristol 0 people / 1 / many; ambassador with 0 / 1 / many invited.

## Not verified here
- Current `cities.is_active` for bristol-gb and whether `teachersDirectory` is still ON in prod (flipped ON 2026-10-26); Jan's account; the content of A#1277's red checks beyond the names above.
