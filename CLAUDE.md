## Design density (mandatory — do not deviate without explicit request)

This project prefers COMPACT, information-dense layouts. Default mobile-first
spacing is too generous for our taste. Apply these rules to every UI change:

- Mobile (≥375px): default to 2-column grids for card lists (venues, events,
  teachers, DJs, dancers, organisers). Never 1-column unless the card
  legitimately needs full width (hero, single featured item, detail page).
- Tablet: 3 columns. Desktop: 4+ columns.
- Card padding: p-3 (not p-4/p-6). Gap between cards: gap-3 (not gap-4/gap-6).
- Card images: 16:9 or 4:3 aspect, not 1:1 squares taking half the screen.
- Typography: text-sm for body, text-base for card titles. Reserve text-lg+
  for page headers only.
- Buttons: py-2 px-3 default. Never py-4 unless it's a primary page CTA.
- Vertical rhythm: prefer space-y-3 over space-y-6.
- Icons: w-4 h-4 inline, w-5 h-5 for prominent. Not w-8+ unless decorative.

When in doubt, make it MORE compact, not less. If a design feels too dense,
Ricky will ask to loosen it — assume compact until told otherwise.

Do NOT produce "Apple-style" generous-whitespace mobile layouts.

## Density exclusions — DO NOT modify these files for density changes

The calendar view and its day-detail modal have a bespoke layout that is
EXEMPT from the density rules above. Do NOT apply density changes to:

- src/components/EventCalendar.tsx
- src/components/calendar/CalendarGrid.tsx
- src/components/calendar/CalendarListView.tsx
- src/components/calendar/DayDetailModal.tsx
- src/components/calendar/calendarUtils.ts
- src/hooks/useCalendarEvents.tsx

Note: src/components/ui/dialog.tsx is a shared shadcn primitive used by other
dialogs on the site. Do not alter it as part of density work on the calendar
modal. It may be adjusted for OTHER dialogs if and only if the change does
not affect DayDetailModal's appearance.

If a task involves any of these excluded files, ask Ricky before changing
anything in them.

## File-write safety (mandatory for agents)

This repo lives on a Windows mount accessed from the Cowork Linux sandbox. The
sandbox's Write/Edit tools sometimes corrupt files >5 KB on this mount,
injecting null bytes or truncating mid-content. Symptoms: build fails with
TS1127 ("Invalid character") errors, file ends mid-statement, `tr -d -c '\0'
< file | wc -c` returns nonzero.

**For non-trivial file writes, use `scripts/safe-write.py`:**

```bash
cat /tmp/new-content.tsx | python3 scripts/safe-write.py src/components/foo/Bar.tsx
```

The script writes to `/tmp` (Linux-native, immune), then verifies + atomically
copies. It exits nonzero on any null-byte detection.

**Guardrails in place:**
- `.githooks/pre-commit` refuses commits containing null-byte corruption.
  Run `bash bin/install-hooks.sh` once after clone (also runs automatically via
  `npm install` postinstall).
- `npm run check:integrity` scans the whole tracked source tree (also wired
  into `npm run lint` so the existing lint workflow catches it).
- `.github/workflows/architecture-guard.yml` runs the same check on every push/PR.
- `.gitattributes` enforces CRLF for source files (Windows-native repo).

If the pre-commit hook flags corruption, repair the file by rewriting via
`safe-write.py` — never bypass with `--no-verify`.
