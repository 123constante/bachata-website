# P2-B PROFESSIONAL BENCHMARK (Website, docs only, web research allowed)

Read `docs/organiser-rebuild/p2/COMMON.md` on this brief branch first. It is binding, especially the owner's answers.

## Your job
Find out what professional organiser dashboards give an event organiser, then mark what OUR organiser area has today. Products to study (public docs, help centres, app-store screenshots, reviews; no sign-ups, no paid accounts): Luma, Eventbrite organiser app, Meetup organiser tools, Dice / Resident Advisor promoter tools, Facebook Events, Fatsoma or Skiddle (UK nightlife), plus Shopify admin and Stripe dashboard for admin patterns (navigation, lists, bulk edit, undo, history, empty states). Also look at Airbnb's host app: the owner admires its warm, photo-led feel, and its hosts are similarly non-technical and phone-first.

Capabilities to cover at least: information architecture/home; onboarding and first event (taking over an existing listing); event lifecycle (draft, live, pause, cancel, end, duplicate); recurring dates and one-off exceptions; courses (multi-week blocks); sessions/line-up linked to real profiles; venue picking; co-host/team (equal roles, invites); photos/covers; how-to-pay line (no ticketing yet); stats for organisers (views, saves); history/audit; attendee notifications; mobile-first editing; bulk edits; undo; previews of the public page; help and empty states; error messages; promoted/featured listings (later revenue); multi-city.

For OUR area, read `origin/main` and the rebuild head `origin/claude/er-c8-eventpage` (94a7e5ea) organiser code (`src/modules/organiser/**`, `OrganiserRoutes.tsx`) and the prototype v7 / rules on `origin/arc/briefs-organiser-r1:docs/organiser-rebuild/er/`. Say which of the two you saw for each row.

## Output (ONE file, ONE push)
Branch `claude/er-p2-benchmark` from `origin/main`. File `docs/organiser-rebuild/p2/BENCHMARK.md`:
1. **Owner summary** (max 15 lines, plain words): what professionals do that we must match for launch, and 3 things we can do better than them for low-tech phone organisers.
2. **Capability matrix**: capability, what the pros do (which products, one line each, source link), OURS have / partial / missing (file:line or "not found"), tag MUST-HAVE-FOR-LAUNCH / LATER / NOT-US, using the owner's answers (courses, stats, line-up from profiles, co-organiser invites, instant publish = launch; notifications, tickets, featured listing = later but leave room).
3. **Patterns worth copying** for phone-first, low-tech users (with a source link and why).
4. **Anti-patterns** seen in those products that confuse organisers.
5. **Sources** list. **Verified / Not verified**.
Do NOT edit source, open a PR, or add labels.
