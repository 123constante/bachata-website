# Handover: R4 "Removed from your events."

Done: R4Night's Remove already navigated to Events with `{ p3Toast: 'Removed from your events.' }`, but R4Events never read it. Added `RemovedToast` (r4Notices.tsx), mounted in R4Events (loading and loaded), `.r4-toast` in r4.css (44px, white/orange), matrix test r4RemovedToast.matrix.test.tsx (8 tests).
Left: nothing in scope. R4Shell.tsx and R4Night.tsx untouched.
Next: owner phone check after a real Remove.
tsc (tsconfig.app.json) run on branch: 0 errors in r4 files (162 repo-wide, pre-existing/typegen-less sandbox).
Not verified: 390x844 browser walk (needs a signed-in organiser session); read-only prod shape survey (no data read added).
