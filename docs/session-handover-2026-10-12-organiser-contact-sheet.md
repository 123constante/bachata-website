# Session handover 2026-10-12: organiser Contact details sheet (contact split)

Branch: `feat/organiser-contact-sheet-split` (one PR, opened READY; number in the PR list).
**DO NOT MERGE until admin PR #771 (contact split migration) is applied to production.**

## Done
- ONE shared mapping `src/modules/organiser/edit-in-place/contactModel.ts`: the card tag,
  the sheet switch + line, the "We will save" line and the saved patch all read
  `contactItems()` / `contactPatch()`. An empty item is never public, and its switch is
  disabled with a reason.
- New FieldKeys `contact_phone`, `show_phone_publicly`, `show_email_publicly`
  (fieldRules.ts, `checkPhone` = the repo's normalizePhoneDigits rule + the server's
  40-character / one-line rule). draftModel: `EditBase = ProfileEntity & { contact }`;
  only changed contact keys are sent. `show_contact_publicly` and `contact_email` are never sent.
- `fetchContactSettings` reads both split flags; the legacy payload (only
  `show_contact_publicly`) gives both flags that value.
- Owner layer: Contact card (`ContactCard.tsx`, masked values, Public/Hidden tags,
  "Edit contact details" row) and `ContactSheet.tsx` (visualViewport-positioned, focus
  trap, real `role=switch` 44px controls). The private read happens in the lazy layer only.
- Legacy "Edit profile" dialog: the old single toggle and the phone/email boxes are removed,
  and the dialog never sends contact keys.
- Tests: contactModel.matrix (16 stored shapes x 5 draft cases + legacy), ContactSheet.test
  (layer end to end), draftModel/fieldRules/visibility.matrix/ownershipApi/patch/legacy-dialog
  updated; phone spec `tests/e2e-phone/organiser-contact-sheet.phone.spec.ts` at
  390x844, 360x640, 412x915. Red-before and green evidence are in the PR body.

## Open / next
- Owner applies admin #771 to prod, then a real-phone walk (owner AND manager): open the sheet,
  flip a switch, Save, and check the public page shows phone/email per flag.
- Email is READ-ONLY in the sheet (server: `contact_email_admin_only`), which differs from the
  mockup's editable Email field. That is the owner's decision.
- `overlap.phone.spec.ts` `/auth` at 360x640 failed locally (decorative `div.absolute.rounded-full`
  on /auth, not touched by this PR). Check whether it is red on main too.
- Lint chain locally: `check:integrity` exit 126 only because `bin/check-integrity.sh`
  is mode 100644 here (`bash bin/check-integrity.sh` reports 0 issues).
