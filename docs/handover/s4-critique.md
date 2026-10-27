# Handover: #1033 S4 front-door screens, design critique + one fix pass (Design Gate stage 5)

Brief: `briefs/s4-critique.md` on branch `brief/s4-critique`. Branch `claude/s4-add-organiser-screens`, PR #1033.
Worker: fresh reviewer, not the builder. Ticket `dt_05d9b4480a35`.

## What changed

The critique is [`docs/design/1033-critique.md`](../design/1033-critique.md): 18 findings, ordered, each with why it
matters to the visitor (the admin, a beginner, on a phone), severity and verdict. Every **blocker** and **should**
is fixed; nothing changes an owner decision, adds a read/RPC, or touches a migration or the existing
`/admin/organisers` list.

| # | Fix | Files |
|---|---|---|
| C1 (blocker) | Disabled buttons no longer look live: no fill, dashed edge, muted words (were the amber primary at 60%; on real data every one of the 48 rows had one) | `frontDoorUi.ts` |
| C2 | Header button "Access" -> "Back" with a chevron, named "Back to Organiser access" | `FrontDoorPage.tsx` |
| C3 | Crumbs: "Home > Organiser access (link) > Add and manage" (new IA node `admin.organisers.frontDoor`; `admin.organisers` gains its path, its own page still shows it unlinked) | `src/lib/breadcrumbs/siteIa.ts` |
| C4 | After an add (or "already added") the form empties, so the armed submit cannot add twice; after an error the typing stays | `AddOrganiser.tsx` |
| C5 | "until you tap Send" -> "until you tap Send invite" (the button's real name) | `addOrganiserModel.ts` |
| C6 | Needs you item with no organiser says "No page is linked to this one, so there is nothing to open." | `needsYouModel.ts`, `NeedsYou.tsx` |
| C7 | The words beside a locked Run by us switch are muted | `frontDoorUi.ts`, `FrontDoorList.tsx` |
| C8 (nice) | "Run by us. Switch Run by us off first ..." -> "We run this page, so there is no invite. Switch Run by us off first to prepare one." | `frontDoorListModel.ts` |
| C9 | Entry button on `/admin/organisers`: "Add and manage organisers" (same name as the page it opens) | `FrontDoorEntry.tsx` |
| C10 (nice) | Theme focus ring on the module's buttons | `frontDoorUi.ts` |
| C18 | The "Organiser added" card (and a form-level error) scrolls into view: it was under the fold at 390x844 | `AddOrganiser.tsx` |

Red first: `1031691` (tests only) failed 20 phone-walk cases and 6 unit cases against the unfixed screens; C18's
in-viewport check was red on its own before its fix. Fixes `2e03840`; docs and retaken shots `05b8402`.

## Owner calls (not in code)

- **C11 open on Needs you when its count is > 0.** Recommend yes: the count is already fetched for the badge, no new
  read. Not changed because which tab opens first is part of the three-tab decision.
- **C14 a name search on the Organisers tab** (150 rows is one long scroll). New content; the existing
  `/admin/organisers` page has one. Recommend later, not this PR.
- **C12 toggle look for the Run by us switches.** Judged not a bug (a tick reads as yes for a yes/no label). Only if
  wanted for its own sake.
- **Whole-page layout shift 0.75 (390) / 0.97 (360)** comes from the site shell, not these screens: the footer jumps
  as the admin check resolves, and the fake-only "dancer profile is missing" banner pushes `<main>` down 169 px. The
  screens themselves measure 0.0000 / 0.0001. Shell and banner are outside this PR (banner excluded by brief).

## CI steps run locally (head before this doc: `05b8402`)

| Job (workflow) | Steps run here | Result |
|---|---|---|
| unit-tests: unit (Europe/London, full) | `npm run test:unit` | 14872 passed, 16 failed in 5 files none of which this PR touches: 15 fail identically on the previous head `510053d` (live-DB contract suites + `integrityCouldNotRun`; this sandbox has no DB secrets, CI was green there), `ogBrandedCardLayout` passed when re-run alone (load). Module + breadcrumbs: 771/771 |
| unit-tests: dancer-area-isolation | self-test + check | pass |
| architecture-guard (Source Integrity) | `bin/check-integrity.sh`, legacy-tables, legacy-program-rpcs, going-legacy-rpcs (+self-test), `lint:architecture`, `AUDIT_STRICT=1 check:images`, image-widths (+self-test), plan-hygiene self-test, workflow-artifact-policy (+self-test), mojibake (+self-test), prove:entry-point (+self-test) | all pass |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | pass. (`tsc -p tsconfig.app.json`: 95 errors, all pre-existing, 98 on the previous head, none in changed lines) |
| perf-budget: bundle-budget | 3 canaries, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all pass |
| phone-qa: phone-qa | `npx playwright test --config playwright.phone.config.ts` | 390 passed, 128 skipped, 2 failed: `invite-w2-golive` phone field x2 (join flow, not this PR); both pass re-run alone (5/5); they failed while guard scripts loaded the machine. Front-door spec alone: 40/40 |
| phone-qa: build-smoke | `npm run build` + `playwright.build.config.ts` | 73 passed |
| e2e-smoke | `npm run test:e2e` | 157 passed, 2 failed: `organiser-layout` "no sideways scroll" passed on re-run; `organiser-home` "a load failure ... Retry recovers" fails identically on the previous head `510053d` here (green in CI there): sandbox-specific, not this PR |
| lint | `npm run lint` | 22 of 22 links green (whole-tree eslint informational, as on main); eslint on touched files: 0 errors |
| real-data-verified, phone-qa-section | PR body sections | the PR body below carries both sections |
| contract-check, live-db-gate, lighthouse, seo, og, synthetic | need prod secrets / a deploy | not run here |

PR checks on the pushed head: see the report that closes this run (the push is the last action).

## Verified

- Every screen x every shape of the fake (40 walk cases at 390x844, the three prod shapes again at 360x640): taps
  >= 44 px, axe contrast clean, no sideways scroll, no clipped text, every disabled control says why, copy matches
  the switch, copy points only at controls on screen, greyed buttons look off, locked switch words muted, Back /
  crumbs, the Add answer on screen, the form empties, the no-page note.
- Pictures retaken and LOOKED at: header to page ground is the one seam every admin page has; cards are border-only
  on the page ground as on `/admin/organisers`; page to footer goes through the layout's darker band (`GlobalLayout`,
  every page). Disabled Send invite now reads as a dashed empty box beside a muted reason; live Send invite on
  Invited/queued rows is the only amber on its row. Crumbs fit one line at 390 and 360.

## Not verified

- **No real data after these fixes.** Prod counts are the owner's 2026-10-25 phone screenshots (All 48 = 42 / 0 /
  2 / 4, Needs you 23); the walk ran on the phone suite's fake Supabase. No RPC was called (brief).
- 430 px wide was not walked (the suite has 390x844 and 360x640 projects only).
- Chromium phone emulation, not Safari on iOS.
- No `/code-review` round: this was a scheduled worker run with nobody to type it. The diff was re-read
  adversarially; Ricky should run `/code-review` before merge per CLAUDE.md.
- Vercel preview not opened (no token used).

## Next steps

1. Owner looks at the retaken pictures in `docs/design/1033/` (contact sheet in `docs/design/1033.md`).
2. Owner decides C11 / C14 / C12.
3. Still PARKED until admin PR #1007 is applied on prod (see `docs/design/s4-add-organiser.md`).

## PR body (ready to paste)

```markdown
## Summary
- S4 front-door screens (`/admin/organisers/front-door`: Add / Organisers / Needs you) plus the entry button on `/admin/organisers`. PARKED until admin PR #1007 is on prod.
- Design Gate stage 5: independent critique (`docs/design/1033-critique.md`, 18 findings) and one fix pass: greyed buttons no longer look tappable (C1, blocker); "Access" became "Back"; crumbs name this page; the form empties and the answer comes on screen after Add; copy names "Send invite"; a Needs you item with nothing to open says so; locked switch words are muted; entry button and page share one name; focus ring.
- Owner calls left open: open on Needs you when it has items (C11), a name search (C14), toggle look for switches (C12).

## Phone QA
- Sizes checked: 390x844 and 360x640 (Chromium phone emulation, `playwright.phone.config.ts`)
- Walked: Add (untouched, Run by us on/off, 6 outcomes, 8 server errors), Organisers (prod 48 rows, Invited 0, empty, one row, 150 rows, long names, every invite status on every chip, send / Run by us answers, loading / error / offline), Needs you (prod 23, every group, refused Approve, empty, loading / error / offline), the `/admin/organisers` entry; 40 cases green, shots in `docs/design/1033/`
- Not verified: 430 wide, Safari on iOS, a real phone after these fixes

## Verified on real data
- Shapes surveyed: owner's 2026-10-25 phone screenshots of the preview on prod (counts only): Organisers All 48 = Run by us 42, Invited 0, Joined 2, Live 4; Needs you 23 in one group "Quiet for 30 days". No database read (brief: no RPC).
- Checks run: those shapes rebuilt on the phone fake and walked at 390x844 and 360x640 with tap-size, contrast, overflow, disabled-reason, copy-points-at-control, greyed-looks-off and layout-shift checks (screen 0.0000 / 0.0001)
- NOT verified: the live RPCs' real answers after these fixes; the fixes have not been seen on real data or a real phone

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01BLVmqPyr3vEz2DHupNLFKW
```
