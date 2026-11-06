# Brief: organiser bio shown once, in the header, 150 characters
Brief-version: 2
Branch: claude/organiser-bio-once
Lane: normal, Sonnet. 123constante/bachata-website, no DB, no migration, no workflow, no calendar density-exclusion file (EventCalendar, CalendarGrid, CalendarListView, DayDetailModal, calendarUtils, useCalendarEvents). Design Gate applies (copy/layout change on a public screen): design record docs/design/<pr>.md, INVENTORY.md first.
Serves: organisers claiming a page (the East London Bachata page shows the same 330-character bio twice) and dancers reading the page.

## What main lacks
- extends: the header shows only the first sentence of the bio (heroTagline), mobile and desktop copies (lines 1148-1149, 1235, 1265) -- src/pages/OrganiserProfile.tsx
- extends: the same bio is repeated in an About section with its own More toggle (aboutExpanded state at :614, aboutIsLong at :1151, block at :1347-1362) -- src/pages/OrganiserProfile.tsx
- extends: a page with no bio has an empty header line; it should read "City and what they run" from facts already on the page model (cityName :1144, organisation_category :1084) -- src/pages/OrganiserProfile.tsx
- extends: the page editor's About check allows 4000 characters (ABOUT_MAX and checkAbout at line 305) -- src/modules/organiser/edit-in-place/fieldRules.ts
- extends: the page editor sheet counter reads n / ABOUT_MAX (FieldSheet.tsx:176) -- src/modules/organiser/edit-in-place/FieldSheet.tsx
- extends: the onboarding page step textarea uses the same ABOUT_MAX (maxLength) with no visible counter (lines 549-552) -- src/modules/organiser/p3/onboarding/PersonFlow.tsx

## Files
src/pages/OrganiserProfile.tsx
src/modules/organiser/edit-in-place/fieldRules.ts
src/modules/organiser/edit-in-place/FieldSheet.tsx
src/modules/organiser/p3/onboarding/PersonFlow.tsx
src/modules/organiser/edit-in-place/__tests__/fieldRules.test.ts
src/modules/profile/organiserHeroBio.ts (new)
src/modules/profile/__tests__/organiserHeroBio.matrix.test.ts (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists, and report the coverage count (inventory items covered / total) at the end. INVENTORY.md and the design record docs/design/<pr>.md are docs, not counted as code files.
1. One shared rule in new src/modules/profile/organiserHeroBio.ts: BIO_LIMIT = 150; heroBio(bio, cityName, category) returns { text, truncated, fallback }. Count code points (Array.from), trim first. Bio of 150 or fewer: shown whole. Over 150: cut at 150 (back to the last space when one exists in the last 20 characters), add an ellipsis written as `\u2026`, truncated = true. No bio: fallback line "<City> \u00b7 <category>" from cityName and organisation_category, either alone when only one exists, null when neither. Never mutate or delete the saved bio.
2. In OrganiserProfile.tsx delete bioParts/heroTagline/aboutIsLong, the aboutExpanded state and the whole About section block. Both header copies (mobile :1235, desktop :1265) render heroBio(...) once; when truncated, a "More" button (min 44px tap target, aria-expanded) expands to the full bio in place and becomes "Show less". Keep `whiteSpace: pre-line`. Keep the edit-layer slots: eip?.mark('bio') on the header paragraph, and give the owner an empty-bio slot where the About slot lived (eip?.slot('about') / 'about-empty') so an owner can still add a bio.
3. Editors: set a shared BIO_LIMIT counter of 150 on the page-edit About sheet (FieldSheet counter n / 150) and the onboarding AboutStep (add the same counter; textarea stops accepting added text beyond 150 when the current value is 150 or fewer). Rule: typing or pasting that would pass 150 is blocked (cut at 150) UNLESS the loaded value was already longer; an old longer bio loads unchanged, the counter shows red "n / 150", and Done/Save is disabled with the reason "Shorten to 150 characters to save" until n is 150 or fewer; deleting text is always allowed. checkAbout takes the new limit; ABOUT_MAX 4000 stays only as the server ceiling. An untouched save of an old long bio sends nothing.
4. Out of scope: the older wizard bio step (wizard/registry.tsx, 4000 limit; follow-up, name it in the PR), the admin bio editor (separate repo), the legacy inline editForm in OrganiserProfile.tsx (check whether it still renders on origin/main; if it does, give it the same limit, and say so in the PR), dancer bios.
5. Pure ASCII source with `\u` escapes or HTML entities only (CLAUDE.md); files over 2 KB go through scripts/safe-edit.py.

## Tests
Table-driven, red first on the unfixed code: bio lengths 0, one sentence (about 40), exactly 150, 151, 330 (the East London Bachata shape) x surfaces: header text and More button (render OrganiserProfile or the shared heroBio plus the header component), no About section rendered, editor counter and Done enabled/disabled, paste behaviour (empty start vs loaded 330-character bio). Plus fallback rows: city+category, city only, category only, neither. Show the new rows red before the change, green after. Run npx vitest run for the touched tests, node scripts/check-mojibake.mjs, npx tsc --noEmit -p . filtered to touched files, and every CI job step that applies (read .github/workflows).
Walk at 390x844 (side laptop, laptop-walk.mjs): the 330-character shape (header shows 150 characters, More expands, no About section), a no-bio page (fallback line), a 1-sentence bio, an owner view with the edit-in-place sheet at 150 and at a loaded 330. Screenshots in the PR.

## Done when
- A page shows its bio once, in the header; no About section; More reveals the full saved text; saved bios are never changed by viewing.
- Editors block adding beyond 150 and make an old longer bio savable only after shortening.
- PR body carries a Verified / Not verified block (Not verified: real phone, signed-in owner on prod).
