# Design record: P3 W0 foundation (organiser redesign, mockup C3), 2026-10-25

Flag: `flags.organiserP3` (`VITE_ENABLE_ORGANISER_P3=true`), default OFF, separate from
`parityGate.ts` `AW1_APPLIED`. While OFF no P3 route exists: `AnimatedRoutes` mounts
`/account/p3/*` only inside `flags.organiserP3 && flags.organiserSelfServe ? ... : null`, and every
R1 organiser route (`/account/o/*`) is byte-for-byte as before (`p3/__tests__/flagOff.test.ts`).

## Brief
- **Who:** an organiser on a phone (390x844), who will run their nights from this area.
- **One job (this slice):** lay the foundation every later P3 slice builds on: the flag, the area's
  frame and tab bar, ONE shared model, ONE tokens file. Placeholders only; no data is read.
- **Feel:** C2/C3's warm ember look, light by default, dark with the phone.

## Chosen mockup
**C3** (`claude/er-p3-mock-c3`, `docs/organiser-rebuild/p3/mockups/C3.md` / `C3.html`): tab bar
Home / Events / Stats / You with C3's four icons; header = the tab's name.

## Tokens (`src/modules/organiser/p3/theme/p3.css`)
- C3's `:root` light set and dark set, scoped under `.p3-theme` (nothing on `:root`, the public site
  or the R1 theme). Dark = `prefers-color-scheme: dark` unless `data-theme="light"`; `data-theme="dark"`
  forces it. The two dark blocks are the same tokens (tested).
- Sizes in px only (html font-size trap): `--tap: 44px`, `--tabbar-h: 64px`, `--top-h: 56px`,
  `--fs-body 16px`, `--fs-small 14px`, `--fs-tab 12px`, `--fs-title 22px`; radii from C3.
- No colour seam: the frame, top bar and page all paint `--bg`; only the tab bar is `--tab`, split
  by a `--line` border. No literal colour outside the token blocks (tested).

## Shared model (`src/modules/organiser/p3/model/`)
- `types.ts` sessions timeline: series session + forward changes ("this and later" as ONE rule,
  C3 walk find) + per-date changes / not running / extras; date status scheduled / cancelled / skip.
- `daySessions` (C3 `dsess`), `span` / `spanText`, ONE `startPhrase` (C3 M1/M3/W1), `cast` (C3 #17),
  ONE `classCount` (no cancelled, no breaks; never `course_total_sessions`), `sessionTitle`
  ("No name yet").
- `roles.ts` role nouns (teacher / DJ / performer, pairs and groups plural).
- `labels.ts` the single list `L` (C3.md "Shared labels") + tab names; ASCII source, punctuation as
  `\u` escapes.
- `kind.ts`: `kindOf` = the CONTRACT section 1 shape; the kind WORD only through
  `src/lib/eventCategory.ts` (`categoryLabelFor` / `deriveCategories` + `CATEGORY_WORD_LABEL`);
  no new mapping (tested: kind.ts holds no word).

### Deviations from C3, from prod data (read-only SELECT, 25 Oct 2026)
- C3 calls the party kind `social`; prod stores `party` (370 items). The model uses stored types:
  `class / workshop / party / show` (C3's picker) plus `masterclass 19 / performance 3 /
  competition 1`, labelled by name.
- 223 prod items have NO start time (220 parties). C3 assumed every session is timed. The model
  sorts untimed sessions last, never lets them decide a start, and says "No time yet" /
  "From 9pm" (start, no end). Red first: `realShapes.test.ts` failed 9 of 14 on the first cut.
- Times arrive as `HH:MM:SS`; read like `HH:MM`.
- `liveDates` also skips breaks (C3 skipped only cancelled; a break does not run).

### Deviations from C3, from existing repo rules
- Dates read "Friday 20 November", not C3's "Fri 20 Nov": the organiser module has ONE date
  formatter (`shared/dateWords.ts` `fullDate`, decision B-S1, enforced by
  `consistency.matrix.test.tsx`), and P3 uses it.
- Day rollover is `ROLLOVER_HOUR` (8am) from `src/lib/programDayRollover.ts` (mirrored with admin),
  not C3's 6am.
- A stored `ends_next_day` wins over the times; '24:00' reads "12am".

### Review round 1 (code-review, high) -> fixed in this PR
Forward changes applied oldest-`from` first; one-offs never read forward changes (daySessions and
startPhrase agree); startPhrase reads the next live date through `daySessions` (its own changes
and extras count); a later time change is compared with the time just before it; dates sorted
before "next"; `cast` keeps a person once per role; the tab bar ADDS the safe-area inset.
Probes: `model.matrix.test.ts` "review fixes".

## Checks
| Check | Result |
|---|---|
| Contrast, 17 text pairs x light / dark (phone) / dark (forced), computed from p3.css | all >= 4.5 (mutant `--mut #9a8d82` fails 4 rows) |
| Tap targets (walk, 4 tabs x 2 themes) | every tab >= 44x44px; bar = 64px + safe-area inset |
| Seam (walk) | frame / top / page one computed colour |
| Sideways scroll at 390 | 0 |
| Flag off (unit) | one P3 route, inside the flag; R1 route block unchanged (mutant without the flag fails) |
| Screenshots | `docs/handover/p3-w0-walk/*.png` (4 tabs x light / dark, 390x844) |
