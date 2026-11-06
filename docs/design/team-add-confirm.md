# Design record: confirm before "Add someone" makes a Manager

**Brief.** One tap on a face or search result added a person as Manager at once. Add a question first:
"Add <name> as Manager of <page>?" with Add and Cancel. Invite path, RPC, who may add, and the Done message
are unchanged. Open-then-Cancel writes nothing.

**Chosen: a bottom sheet** (`SheetView` via new `AddConfirm.tsx`). Why: it is the primitive other organiser
confirms use (`SignOutSheet`), so it matches; Radix gives the focus trap, Escape and backdrop = Cancel, and
focus back to the tapped face (`useOpenerRef`, for iOS Safari taps). Buttons are `size="sm"` (44px) and the
sheet is thumb-reachable on a phone.

**Rejected: inline confirm row under the face.** In a 3-column grid it reflows the wall under the thumb and
is hard to anchor for a search row.
**Rejected: browser `confirm()`.** Unstyled, blocks the thread, cannot show a pending state or the disabled
full reason, and is flaky in in-app browsers.

**Failure handling.** A failed add closes the sheet and the existing `add-error` line shows; a retry needs a
fresh tap. `team_full` keeps Add disabled. Missing page name reads "this page".

## Merge with main (2026-11-06)
Merged origin/main (#1411, #1412) into the branch. One conflict in AddSomeone.tsx: kept the confirm sheet and main's page-name suffix on the Done message. teamPageName.matrix test now taps `add-confirm-yes` after the face. Vitest team + p3: 106 files pass. tsc run on 2cb7b282: 0 errors in branch files. mojibake clean.
