# Team tab: fix round on the picked option (owner picked Option B)

Docs-only continuation on the existing branch claude/profile-dash-organiser-team-opts (PR 1579). Read your own handover and organiser-team.md first.
Owner picked **Option B** (grouped by role). Keep B as the single design; mark A "not picked" in organiser-team.md. Fake people only. Plain-English why notes.

## Fixes (from the independent critique), do all
B-specific:
1. "Waiting to join" sits above Owners and expired invites push people off the first screen. Put it after Contributors, cap at 2 with "Show all N", expired collapsed.
2. The fixed "Add a teammate" button covers rows. Make it a normal button after the list for large teams (or pad correctly); no row half hidden in any shot.
3. `solo` shape: ~500px empty gap and copy "Tap Add a teammate below". Move the button under the card, drop the copy.
4. Empty-group "Add" duplicates the fixed button. Label it "Add a contributor" (different action) or remove one path.
5. Add a "Hidden" marker on rows where the person is hidden from the public page.
Shared (core.js):
6. Contributor view: say "Shown on the public page", not "your public page".
7. Reword Contributor role line to "Can look at events, tickets and the team, but cannot change anything."
8. Error state: replace "Your public page still shows the same people" with "Nothing was changed."
9. Mask invitee emails from contributors in Waiting rows (d***@example.com) or hide Waiting from them.
10. Find tab: a picked person must show a tick (or leave the results) so chip and results agree.
11. Add a shot of the contributor sheet with the per-person public-page switch, one on and one hidden.
12. Confirm "Ritmo London" is not a real prod organiser (read-only SELECT on organiser names, no personal data); if it is, rename to a fake name.
Re-run checks (contrast >=4.5, taps >=44px, no sideways scroll, 390x844), update organiser-team-checks.json and the handover. Docs-only: no Phone QA section in the PR body.
