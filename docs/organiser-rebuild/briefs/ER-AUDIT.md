# ER-AUDIT (Website repo `123constante/bachata-website`): read-only audit of ONE slice family of the organiser events rebuild

OPUS, effort high, READ-ONLY on source. You push exactly ONE new file. The family you audit is named in your dispatch line (`FAMILY=<key>`). Nothing is merged, applied or fixed by you.

## Why
The owner's charter (2026-10-21): "a wholesome job, not patches": every slice already built is audited against the design and the rules, and weak ones are rebuilt from scratch by a fresh worker. You return KEEP / FIX / REBUILD per slice with reasons the orchestrator can act on without re-reading the code.

## Families (branch -> what it should be)
| FAMILY | Branch(es) | Cards/briefs (`git show origin/arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/<file>`) |
|---|---|---|
| rules-shell | `claude/er-s1-rules` | ER-C3.md |
| editor-cards | `claude/er-c4-sessions`, `claude/er-c5-venue` | ER-C4.md, ER-C5.md |
| new-event | `claude/er-c7-new` | ER-C7.md |
| event-page | `claude/er-c8-eventpage` | ER-C8.md |
| dates | `claude/er-c9-dates` | ER-C9.md |
| festival | `claude/er-c10-festival` | ER-C10.md |
| co-organisers | `claude/er-c11-organisers` | ER-C11.md |
| public | `claude/er-c6-public` | ER-C6.md |

Also read for every family: `ER-COMMON.md`, `ER-INTERFACE.md`, and the plan `docs/organiser-rebuild/er/` (prototype v7 HTML, rules 1-65, the three mockups, DESIGN-base.md) on `claude/er-c1-docs` (or `er-wave1`). The look layer (`src/modules/organiser/ui/**`, Ember) is already on main (People arc #897); judge against what is on `origin/main`.

## What "correct" means now (owner decisions, binding)
- **Everyone on an event has full control** (2026-10-22): every organiser on an event sees and can use cancel (one date and the whole one-off), stop repeating, and the organiser list. NO "owner only" / "owner team" copy, disabled state or hidden control anywhere. Flag every place the slice hides or disables these for a non-owner.
- **Retries are success:** a retried invite or cancel that the server answers `already invited` or `invalid_payload: this invite is no longer open` must show SUCCESS on screen, never an error.
- **Leaving or removing an organiser** cancels the pending invites they sent: the screen must refresh its invite list, and must not offer to answer an invite that is gone.
- **Festival artist list is read-only after the festival ends**; the screen must say so, not fail on save.
- **Course stays OFF** with the reason "Not available yet". **Festival create is now supported by the server (AD2)**: the 2026-10-21 "festival OFF on New event" click answer was conditional on the server; judge the slice against BOTH and say what it takes to switch it on.
- **Category is derived**, organisers never pick it. A class is only a session kind inside an event; a course is a block of class sessions.
- Compact density (3-col mobile grids, `p-3`, `text-sm`); calendar files on the density-exclusion list are untouched without the owner. Entities in JSX (`&mdash;`), not raw Unicode punctuation. British English, full weekday names. Phone first (390x844); the site's html font-size is ~13.5px on phones, so use explicit px for tap targets (>= 44px).
- Server truth is admin: `docs/organiser-rebuild/er/handover/ER-AD1.md` / `ER-AD2.md` ("as built") on admin branches `claude/er-ad1-admin`, `claude/er-ad2-admin` (read with `git show`; use plain git on the admin repo only if your sandbox has access, else read the interface file).

## Audit for (in this order)
1. **Mounted?** Is every screen of the slice reachable from a real route behind the rebuild switch (`VITE_ORGANISER_REBUILD`, `OrganiserRoutes.tsx`)? Trace imports from the route to the component; list screens that exist but are unmounted.
2. **Matches prototype v7 + the plan rules 1-65** for this family: list each rule number the slice owns, and PASS / FAIL / NOT BUILT with file:line.
3. **Matches the server as built** (ER-INTERFACE AS BUILT + AD1/AD2 handovers): RPC names, payload keys, error texts mapped, result keys read.
4. **Every shape** the screen will meet (use read-only SELECT counts on prod `stsdtacfauprzrdebmzg`, never a write: lifecycle x format x counts x null/empty x past/cancelled x >100 rows; two-organiser events (6), no-organiser events (571), draft with and without an occurrence row, course 15, festival 12): does the screen handle each, is every empty state helpful, is every dead control disabled with a reason?
5. **Tests:** are they table-driven over shapes and can they fail (would a wrong implementation still pass)? Run the family's test files and the lint chain pieces that apply; report counts. Say which are vacuous.
6. **Design record** (`docs/design/`), contrast, tap targets, clipped text, sideways scroll, colour seams: from code and any screenshots; say what you could not see.
7. **Dead code and duplication:** copies of a mapping that exists elsewhere (status tags, rules), `sections/` files with no importer.

## Output (ONE file, ONE push)
Branch `claude/audit-er-<family>` from `origin/main`. File `docs/organiser-rebuild/er/audit/ER-AUDIT-<family>.md`: verdict per slice KEEP / FIX / REBUILD with one paragraph why; a findings table (id, severity blocker/major/minor, file:line, what, failing scenario, fix in words); a "full control" section (every place that still says or enforces owner-only); a "REBUILD would need" list if you say REBUILD (what a fresh worker must be told differently); Verified / Not verified. Do NOT edit source, add labels, or open a PR yourself. Last commit subject ends `[worker-done <ticket>]`.

## Do not
No prod write (SELECT only). Plain git only (no `gh api`). Never `--no-verify`. One push. Stop at 30% context with a PARTIAL push and a "what is left" list.
