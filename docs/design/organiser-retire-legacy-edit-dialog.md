# Organiser page: retire the legacy Edit profile dialog

Brief: `docs/briefs/organiser-retire-legacy-edit-dialog.md` (branch `brief/organiser-retire-legacy-edit-dialog`, blob a27e161). Grep marker: `retireLegacyEditDialog`.

## INVENTORY (written before any code change; line numbers on origin/main bc7f071)

Legacy dialog: `src/pages/OrganiserProfile.tsx:1538-1588` (`<Dialog open={isEditOpen}>`), opened only by `openEditModal` (`:897`) from the owner-blank "Complete your profile" button (`:1358`).

| Legacy field (dialog line) | Edit-in-place equivalent | Where |
|---|---|---|
| Name (`:1544`) | NameSlot pencil beside the h1 | `EditInPlaceLayer.tsx:382`, `parts.tsx:151-157`, FieldSheet text input `FieldSheet.tsx:264-290` |
| Category, free text (`:1548`) | MetaSlot "Add category" chip, category picker | `EditInPlaceLayer.tsx:383-391`, `parts.tsx:177-182`, `FieldSheet.tsx:187` |
| Founded year (`:1552`) | MetaSlot "Add year started" chip + Complete card row | `parts.tsx:172-176`, `FieldSheet.tsx:56,64,269`, `fieldRules.ts:79` |
| Avatar URL, raw text (`:1556`) | PhotoSlot pencil, validated upload | `EditInPlaceLayer.tsx:381`, `parts.tsx:131-139`, `FieldSheet.tsx:128,222-260` |
| City, CityPicker (`:1560`) | MetaSlot city chip, search + confirm | `parts.tsx:165-171`, `FieldSheet.tsx:146-148,209-221`, `CitySheetBody.tsx` |
| Bio (`:1564`) | AboutSlot pencil, BIO_LIMIT check | `EditInPlaceLayer.tsx:392`, `parts.tsx:185-192`, `FieldSheet.tsx:93,167` |
| Instagram | LinkRows pencil | `EditInPlaceLayer.tsx:394-400`, `parts.tsx:200-231` |
| Facebook | LinkRows pencil | same |
| Website | LinkRows pencil | same |

**Coverage: 9 / 9** legacy fields have an edit-in-place editor. Saving: `draftModel.ts:350` still calls `saveOrganiserProfile` (kept; `organiserProfileUpdate.ts` untouched).

Gap found (NOT fixed here, outside this brief's scope): on the PUBLIC page the hero renders `slot(ep.bio ? 'about' : 'about-empty')` (`OrganiserProfile.tsx:1256,1288` on main), so an owner with NO bio who is not owner-blank (they have links, a team or nights) has no About pencil on `/organisers/:slug`; the organiser shell (`src/modules/organiser/page/index.tsx:110-111`) always renders it. The legacy dialog never reached that case either (owner-blank only), so this PR does not regress it.

## Design (chosen)

The owner-blank empty state's gold "Complete your profile" button is replaced by an "Add a bio" pill holding the real About pencil (`eip.slot('about')`, 44x44 px tap target), next to the existing "Create your first event" link; the copy points at the photo pencil and the Your links pencils, which the owner layer always renders. Before the lazy layer loads, a disabled "Loading your editor&hellip;" control (44 px) says why nothing is tappable yet, and the copy names no control.

## Rejected alternative

Moving the "Complete your page" card (`slot('card')`) into the empty state: it hides once photo, year and Instagram are saved, so an owner-blank profile (no bio, no links) could be left with no action at all, and it has no About row, the one field owner-blank is defined by.
