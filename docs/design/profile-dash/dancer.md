# Dancer dashboard: 2 options (admin #1545) -- design record + handover

Brief: `docs/briefs/profile-dash-dancer-opts.md` on `brief/profile-dash-opts`. Docs / design only, no `src/` change, no DB write.
Base: `docs/design/profile-dash/prototype.html.md` on the brief branch (role strip, top-right Switch sheet, Bricolage Grotesque + DM Sans),
and option B "one step at a time" (`docs/design/dancer-dashboard/option-b-polished.html` on main; the original `option-b.html` from
PR #1561 is not on origin, so the polished copy was used). Where they differ, the prototype wins (role strip instead of the picture switch).

Files: `dancer-option-a.html`, `dancer-option-b.html` (open in a browser; the controls above the phone switch every shape and
"Dancer only" vs "Dancer + DJ + Organiser"; `?s=<shape>&shot` opens one bare 390x844 frame). Screenshots: `shot-a-<shape>.png`,
`shot-b-<shape>.png` (390x844 at 2x) for new, unfinished, saveOff, complete, completeEmpty, unclaimed, switch, add, account.

## The two options (same colours, same copy rules; the layout idea differs)

| | Option A: one action card + a short list | Option B: your page first + 3 tiles |
|---|---|---|
| Main card | The one thing to do now: next step (D1/D2), Nights attended (D3), claim (D4) | A preview of your page as dancers see it; the one thing to do is a band under it |
| D2 checklist | All 4 steps in the card, done ticked, next one marked "next" + its button | Only the next step + a 4-segment bar; "Then: ..." line lists what follows |
| Then | 3 list rows (icon, title, one-line status) | 3 tiles in a row (Find a night, preview / share, edit) |
| Going | A row; empty = "Nothing booked yet. Find a night." | Next night as one line in the band; empty = empty-state card |
| Why pick it | Reads like a to-do; status words visible without tapping | Shows WHY each step matters (gaps are visible placeholders on the preview) |

**Recommendation: Option B.** It keeps the owner-picked "one step at a time" idea, and the preview makes a stub account's
gaps concrete ("Your name here", "No photo") instead of abstract. A wins only if the owner wants the full checklist on Home.

## Journeys covered (both options)

- **D1 new stub**: Finish your profile, step 1 of 4, next step button (`NEXT_STEP` labels verbatim), preview, no stats
  (one line: "Your numbers start after your first night out").
- **D2 unfinished**: next missing step shown. **Save off** (`?s=saveOff`): Edit with untouched fields, Save disabled
  (dashed, muted, contrast >= 4.5) + "Change something to save. Nothing is sent until you do."
- **D3 complete**: checklist hidden. Nights attended 12; with 0 it is an empty state ("Find your first night" + why + Browse this week).
  Going with nothing booked is an empty-state card, never a "0" tile.
- **D4 unclaimed match**: "Found a match" pill, "Claim your page" primary, "This is not me" secondary.
- **Switch sheet** (top right, as prototype): Dancer / DJ / Organiser groups, "Showing" tag, + Add a profile, Account and help.
  With one profile the strip button reads "Account" and opens the Account sheet (D129: no switch for one profile).
- **Add a profile**: "Run events? Become an organiser" (live label, `optionsModel.ts:76`) and "DJ or teach? Message us".

## Inventory (file:line, on main @ 19b73f5)

Full field inventory (72 rows) is `docs/design/dancer-dashboard/INVENTORY-polish.md`; the facts this round leans on:

| Fact | Source |
|---|---|
| 4 required steps: first_name, city, role, photo | `src/modules/dancer-app/api/nextStep.ts:18` |
| Next-step button labels ("Add your first name" ...) | `src/modules/dancer-app/api/nextStep.ts:21-29` |
| Switch shows only with 2+ profiles (D129) | `src/modules/dancer-app/shell/SwitcherGate.tsx:7-15` |
| Claim is AUTOMATIC at sign-in, `claim_my_dancer_profile_v1()`, no args | `src/lib/claimMyDancerProfile.ts:7-27` |
| Claim statuses (linked, no_match, ambiguous, email_unproven ...) | `src/lib/claimMyDancerProfile.ts:29-36` |
| Numbers shape (views, went, votes; no views tiles here by brief) | `src/modules/dancer-app/api/numbersModel.ts:14-25` |
| Going count comes from `get_my_going_v1` | `src/modules/dancer-app/api/numbersModel.ts:9-10` |
| "Become an organiser" label | `src/modules/dancer-app/screens/options/optionsModel.ts:76` |
| Dark tokens | `src/modules/dancer-app/theme/dancer.css:13-21` |

## Gaps / owner calls

1. **Claim button has no click RPC.** Claim is automatic on sign-in. The drawn button re-runs the same no-arg
   `claim_my_dancer_profile_v1` (safe: a no-op when nothing matches) and reports the status. If the owner does not want a
   second call path, the button becomes "Message us to claim it" (polish.md decision 9). Needs an owner yes before build.
2. "This is not me" has no backend today; it would be a message to us.
3. DJ is drawn as an area row ("DJ area"); `ProfileSide` is dancer | organiser only.

## Alternatives rejected

- Stat tiles / page views / chart: banned by the brief.
- "0" as a big number when empty: empty state instead.
- Picture-as-switch from polish.md: the owner confirmed the prototype role strip + top-right Switch.

## Checks (2026-11-12, Playwright Chromium 390x844, 2 options x 9 frames)

| Check | Result |
|---|---|
| Every button >= 44x44 | 0 under, 18 frames |
| Text contrast >= 4.5 (3 for disabled) | 0 failures |
| Sideways scroll / element past frame edge | 0 |
| Clipped text (non-ellipsis overflow) | 0 |
| First screen fits 844 without scroll | yes, all 18 |
| ASCII only (entities for punctuation) | yes |

Not verified: Google Fonts were blocked in the sandbox, so screenshots use the fallback font; real-device check; owner pick.

## Real-data shapes (read-only SELECT, prod, counts only)

`dancer_profiles` by claimed x required steps done: unclaimed 0/1/2/3/4 = 20/26/46/62/45 (199); claimed 3/4 = 3/11 (14).
So D4 (unclaimed admin-made) is the dominant real shape, D2 exists among claimed (3), and no claimed profile is at 0-2 steps.

## Handover

Done: both options, 18 screenshots, this record. Left: owner picks A or B; owner call on gap 1. Next: build slice on the pick.

tsc run on 9195773: 0 errors in branch files (no .ts/.tsx touched). check:mojibake clean, AUDIT_STRICT=1 check:images clean.
