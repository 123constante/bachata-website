# Organiser platform rebuild, PHASE 2 (discovery): shared context for workers A and B

Repo `123constante/bachata-website`. Both workers are READ-ONLY on source and push ONE new doc file each. Nothing is merged, applied, fixed or opened as a PR by you.

## Why this exists
The organiser area was built in ~13 slices by separate workers. Each passed its own tests, but every walk of the joined-up result finds new flaws. The owner stopped patching (2026-10-23): "act as a professional web developer and senior platform designer ... rebuild a professional production-grade platform, not fixing." Approved phase-1 brief: KEEP the Ember look + prototype v7 flows, the live server commands AD1-AD4, the shared tested event rules (`event-rules.json`, also copied in admin), and binding owner decisions. REBUILD: one app shell + one navigation model (no old screens mixed in), one way to read/save an event (save, undo, conflict), one component set (lists, sheets, errors, empty states), a11y, phone speed, error reporting, tests that walk real shapes.

Scope = ORGANISER AREA + the public event page and calendar row it feeds. Not the dancer app, not admin, not a public-site redesign.

## Who it is for (owner's 50 answers, 2026-10-23, BINDING)
- Organisers are the priority. LOW tech comfort (WhatsApp/Instagram level), PHONE almost always (390x844). The owner invites each personally.
- Day one = TAKE OVER their existing event (already on the calendar), matched AUTOMATICALLY, no claim/approve step. Help = help text inside the app.
- Biggest fears: organisers give up because it is confusing; wrong info shown publicly.
- Launch scope: weekly socials, one-off parties AND COURSES (course create must be switched ON; it is "Not available yet" today). Festivals kept, lower priority.
- Organisers do: add/edit events, cancel/move dates, line-up and sessions (pick REAL profiles of teachers/DJs), photos/covers. Admin-only: deleting events, merging duplicates.
- Co-organisers ALL EQUAL (everyone on an event has full control; no owner-only controls). Organisers can invite co-organisers to their own events.
- Publishing goes live INSTANTLY (no review). SIMPLE STATS (views, saves per event) AT LAUNCH.
- Later, not now: attendee change notifications, selling tickets, first paid product = featured/promoted listing (design must leave room for it).
- Taste: Airbnb-warm, keep Ember and polish, friendly simple wording, spacious one-thing-per-screen, light/dark follows the phone, English only (British English).
- Business: Bachata only; ambition Europe and beyond (next goal after 10 organisers = more cities), so nothing London-hardcoded.
- Rollout: pilot with 5 organisers, then everyone; an off-switch must exist.
- Success: in the first 4 weeks after launch, 10 organisers create or update an event themselves with no help, and no event needs an admin fix.

## Known symptoms (walk of Website #914 head 94a7e5ea, 2026-10-23, switch ON)
W1 Back from Organisers lands on the OLD /details screen. W2 `default_music_styles` stored lowercase on 37/63 live series -> duplicate chips ("bachata" ticked + "Bachata" unticked). W3 two Details rows both called "Ticket link". W4 title rename button 30px tall (< 44). W5 a server refusal (viewer_role_mismatch) shown as "Check your connection". W6 Stop-repeating dates past this year show no year. W7 Pause/Cancel buttons not baseline-aligned.

## Where things are (read with `git show <ref>:<path>` / `git ls-tree`, plain git only)
- `origin/main`: the live site. Organiser area under `src/modules/organiser/**` (Ember look layer `src/modules/organiser/ui/**`), routes in `OrganiserRoutes.tsx`, rebuild switch `VITE_ORGANISER_REBUILD`.
- Integrated rebuild head: `origin/claude/er-c8-eventpage` at `94a7e5ea` (PR #914; merges S1-S6). Frozen PRs kept as reference only: #903 #904 #905 #914 #917 #919 (admin #908).
- Plan + prior audits on `origin/arc/briefs-organiser-r1`: `docs/organiser-rebuild/briefs/ER-*.md`, `docs/organiser-rebuild/er/` (prototype v7 HTML, rules 1-65, mockups, DESIGN-base.md), audits `docs/organiser-rebuild/er/audit/ER-AUDIT-*.md` (on `claude/audit-er-*` branches).
- Onboarding/invite journey is being built RIGHT NOW by another arc (brief `origin/brief/invite-journey:briefs/invite-journey/*.md`, branches `claude/invite-w1-join`, `claude/invite-w2-phone-ig-golive`, `claude/invite-w3-names-person`; admin `claude/invite-a1-*`, `claude/invite-a2-*`). It ships FIRST. Treat it as salvage to keep; do NOT re-plan onboarding, only note where the organiser area must connect to it.
- Server truth lives in the admin repo (`123constante/bachata-admin`): AD1-AD4 handovers `docs/organiser-rebuild/er/handover/ER-AD*.md`. If your sandbox cannot read admin, use the interface file `docs/organiser-rebuild/briefs/ER-INTERFACE.md` and say so.
- Prod Supabase project `stsdtacfauprzrdebmzg`: SELECT only, counts only, never a write, never personal data in your output.

## House rules
Plain git (never `gh api`). Never `--no-verify`. One push. If you reach your context cap, push a PARTIAL with a "what is left" list. Last commit subject ends `[worker-done <ticket>]`. Write for a non-technical owner where you summarise (top of the file); evidence below it.
