# REVIEW-SW1 -- independent review of the SW1 slice (Website)

- Ticket `dt_62eaeb687ffe`. Brief `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/REVIEW-SW1.md` (blob 60751e1).
- Reviewed `claude/org-r1-parity-sw1` @ `d20de737` against `claude/org-r1-integrate` @ `7d9751c`. Reviewer is not the author; no source changed (this branch adds this file only).
- Prod reads: read-only SELECT on `stsdtacfauprzrdebmzg`, counts and catalogue only (function bodies, FKs, columns), 2026-10-18.

## Verdict

**Not ready to flip `AW1_APPLIED`.** The slice is safe to MERGE with the gate off (nothing writes; verified), but two BLOCKING data-loss paths fire on the first real Save once the gate is on. Both need fixing (B1 needs AW1 / the admin writer too) before the merge train flips the gate.

## Findings

### BLOCKING

**B1. Any series programme Save wipes every per-date session change of that series.**
- Where: `src/modules/organiser/events/programmeSeriesModel.ts:294-321` (`buildDays` sends no item `id`) + prod writer `_cmd_series_set_program_p5` (`DELETE FROM event_series_program_day_p5 WHERE series_id = ...`, then re-insert with new ids) + FK `event_occurrence_session_override_p5.program_item_id REFERENCES event_series_program_item_p5(id) ON DELETE CASCADE`.
- Scenario: an organiser renames one class on a live weekly series and taps Save. The delete cascades day -> section -> item -> **every `event_occurrence_session_override_p5` row** of the series. Prod today: **88 overrides on 18 live recurring series** (+1 on 1 ended) would be lost on their first Save. The screen even shows "Differs on N dates" right above the Save that erases those differences, and the delete confirm (`ProgrammeSeries.tsx:63`) promises "Dates you changed yourself keep their own sessions" -- false for every session, not only the removed one.
- Also lost on every Save: `legacy_program_item_id` (595 items carry one; not in the payload, not read by this repo -- NOTE-level on its own) and `created_at`.
- Fix (one sentence): send each stored item's `id` in the tree and have AW1's `series.set_program` upsert items by id (delete only the ids that left the tree), with a test that an untouched item's override survives a Save -- until then keep `AW1_APPLIED` false.
- Note for the arc: the admin editor calls the same writer; if it has the same shape, admin Saves already do this on prod today. Worth a read-only check in the admin repo (not reachable from this session).

**B2. Switching a person's role rewrites their `profile_type`, pointing the row at a profile that does not exist.**
- Where: `programmeSeriesModel.ts:235-238` (`setPersonRole` sets `profileType: profileTypeOf(role)`), offered for every existing teacher/DJ by the role chips at `ProgrammeSheet.tsx:121-124`.
- Scenario: on a class with teacher Ana (`profile_type teacher`, a TEACHER profile id) the organiser taps "DJ". The tree now sends `{profile_id: <teacher id>, profile_type: 'dj', role: 'djing'}`. `resolve_epp_person_v1(profile_id, 'dj')` resolves nothing, so the public page and the snapshot read her as unnamed / unlinked. Prod today has 0 such mismatches (every djing row is `dj`, every teaching row is `teacher`), so the editor would be the first thing to create them.
- Red evidence (reviewer test, appendix): `switching a teacher to DJ keeps the profile_type of the profile the id points at` -> `AssertionError: expected { profile_id: 't1', ... } to match object { profile_id: 't1', profile_type: 'teacher' }`.
- Fix: keep `profile_type` from the picked profile (never derive it from the role), and offer a role only that the profile type can hold (a teacher profile teaches; a DJ profile DJs) -- or drop the role chips for stored people.

### SHOULD

**S1. RECENT people carry no profile type; a role-less or dual-role recent person can be added with the wrong `profile_type`.** `programmeSeriesApi.ts:30-34` keeps only `role` (djing wins over teaching), `ProgrammeSheet.tsx:160-164` adds with the sheet's role and `profileTypeOf(role)`. A DJ profile with `roles: []` added to a class is sent as `profile_type: 'teacher'`; a teacher who also DJs never appears in a class's RECENT list. Fix: pin `profile_type` in the `organiser_series_cast_v1.recent_people` shape with AW1 and add with it.

**S2. Empty stored sections are deleted by any Save.** `programmeSeriesModel.ts:300` filters `s.items.length > 0`; prod has **90 empty sections** (0 with a `label_override`, so no words are lost). Decision 4 in the handover makes this deliberate, but the admin editor shows those sections and the organiser is not told. Fix: send empty sections back as stored (only drop a section this screen emptied), or record the owner decision. Reviewer test fails today: `expected [ 'party' ] to deeply equal [ 'classes', 'party' ]`.

**S3. Level reads two ways across screens.** Series programme shows `B / IM / IN / AD / OL` (`ProgrammeSeries.tsx:39`, `ProgrammeSheet.tsx:101,129`); the per-date sheet shows the words (`dates/DateSheet.tsx:227`, `LEVEL_LABEL`). Same fact, two readings, which the brief forbids. Fix: one renderer (short chip + word) used by both, or words on both.

**S4. The cast empty state points at an action the screen cannot offer.** `Details.tsx:217` (cast row) always shows `CAST_EMPTY` "Add a teacher to a class to show them here." -- also on a festival (programme read-only), an ended event (row not a link), and with the gate off (Add disabled). Fix: pass the programme's `off` reason and show it instead of the call to action when editing is not possible.

**S5. Raw Unicode punctuation in source.** `programmeSeriesModel.ts:255` (en dash in `timeLine`), `ProgrammeSeries.tsx:43,84` (middle dot inside template literals). CLAUDE.md: never raw Unicode punctuation in source (mojibake risk). Fix: `\u2013` / `\u00b7` escapes in the strings (or `&middot;` in JSX, as line 84 already does for its second dot).

**S6. The cast line is unbounded.** `Details.tsx:217` cast row has no clamp; a prod festival with 76 people renders one paragraph of every name on a 390px screen. Fix: first N names + "and N more".

### NOTE

- N1. `title` null -> `''`: 239 stored items have a null/blank title; a Save re-inserts them as `''` (the writer does not `NULLIF` title). Readers treat both as empty; harmless today.
- N2. `sort_order` / people `sort` are renumbered from position (0..n). The snapshot orders by them, so order is kept; only gapped values change.
- N3. Level chips on rows are `<span aria-label>` with no role; most screen readers ignore `aria-label` on a generic span. The word is in `title`, so sighted hover is fine; use `sr-only` text like the sheet does.
- N4. `useSeriesRole` returns `null` while `organiser_home_v1` loads, so the programme briefly shows "Only the people who run this event can change its programme." Show a skeleton until loaded.
- N5. `ORGANISERS_EMPTY` "Ask the Bachata Calendar team to link your page" sits next to an enabled "Link a page" for an owner (gate on). Reword for the owner case.
- N6. dancer-app first-load grows 364.2 -> 364.4 KB with this slice (organiser code is lazy; the 0.2 KB is a shared module). Not the cause of the red, but it widens it.
- N7. 100-date cap on "Differs on N dates" (author already lists it).

## Brief checks

| # | Check | Result |
|---|---|---|
| 1 | Data safety of `series.set_program` | Echo of every field the editor does not touch is CORRECT for all three prod-like shapes (weekly classes+party; festival 2 days with day labels, offsets, `label_override`, `workshop`/`performance` types, venue_room/track/parallel_group/theme/room/style, dancer/performing + teacher/mc people; social section + `show`/`competition`) -- reviewer table test passes; mutation (theme echo -> `null`) turns all 3 red. BUT B1 (cascade of per-date overrides), B2 (profile_type rewrite) and S2 (empty sections) lose data. |
| 2 | Gate honesty (`AW1_APPLIED=false`) | Holds. `programmeOff` / `organisersOff` return "Needs the next platform update"; every up/down/remove/add carries `aria-describedby` to the visible reason; Save goes through `SendButton` with the reason / `aria-disabled` + guarded `onClick`; the sheet does not open while off; RPC `organiser_series_cast_v1` is only called when the gate is on. Music chips write `series.upsert default_music_styles` (already allowed on prod, correctly ungated). Exception: S4 copy. |
| 3 | Screen x shape | Session count reads from one `sessionCount` on Details and the programme; role words from one `PEOPLE_ROLE_LABEL`. Festival read-only with reason; ended/archived locked through `eventLock`; course edits like recurring. Inconsistent: level (S3), cast empty state (S4). |
| 4 | 390x844 UX / a11y | Buttons are px-sized 44px (`h-[44px] w-[44px]`); in-page confirm (no `window.confirm`); `focusReturn.test` covers the two new sheets. Issues: S5, S6, N3, N4. The reviewer did not re-walk in a browser (author's shots in `docs/organiser-rebuild/walk-SW1/` read). |
| 5 | Parity matrix integrity | The 5 new rows name `SERIES_PROG` / `DETAILS` / `SERIES_ORGS`, each with a `from` entry checked by `REACHED` (routed import closure) + `codeOnly` token. Counts are COMPUTED (`PARITY.filter(r => r.verdict === v).length`) and compared against the pinned `{45, 11, 8, 7}` -- that is a ratchet, not typed prose. OK. `SW1-cast` is MATCH while the admin CAST row reads `organiser_series_cast_v1`; acceptable (decision 1). |
| 6 | CI (below) | Same as the author's; bundle-budget red confirmed on the base. |

## CI, run by the reviewer on `d20de737` (sandbox)

| Job | Command | Exit |
|---|---|---|
| architecture-guard | `bin/check-integrity.sh` | 0 |
| architecture-guard | `npm run check:legacy-tables` / `check:legacy-program-rpcs` / `lint:architecture` | 0 / 0 / 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 |
| typecheck | `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| lint chain | `npm run lint` | 0 (20/20) after `chmod +x bin/*.sh` as CI does; first run 1 = `check:integrity` exit 126 (sandbox file mode, not code) |
| unit-tests (scoped) | `npx vitest run src/modules/organiser tests/regression` | 0 (121 files, 3807 passed, 2 skipped) |
| perf-budget | `VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build` | 0 |
| perf-budget | `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 |
| perf-budget | `check:bundle-budget` | **1 on head AND 1 on base** (`7d9751c` rebuilt in a worktree): base dancer-app 364.2 KB vs 364, auth chunks 34 vs 33, dancer-app 59 vs 58; head identical but dancer-app 364.4 KB. Pre-existing, owner call on allowances |
| e2e-smoke | `npm run test:e2e` | 1 on the full run (156 passed, 2 failed, 1 skipped: `auth-magic-link-returnto.spec.ts:113` and `dancer-home.spec.ts:168`, both `locator.fill` timeouts after 15 s in specs this diff does not touch); the two re-run alone: 0 (2 passed). Load timing under 2 workers in the sandbox, not this slice |
| reviewer test | appendix test, temporary file under `events/__tests__/` (not committed) | 3 echo cases pass, 3 known-gap cases fail (B1, B2, S2); mutation theme->null: 3 echo cases fail |

Not run: full `npm run test:unit` (the author's 15 live-DB sandbox failures are known); `check:lighthouse`, `check:doc-weight`; the DB contract workflow (needs secrets).

## Verified / Not verified

**Verified:** the prod writer and snapshot bodies (read this session); the FK `event_occurrence_session_override_p5.program_item_id ON DELETE CASCADE`; prod counts: 89 overrides on 19 series (88 / 18 live recurring), 595 items with `legacy_program_item_id`, 90 empty sections (0 labelled), 0 empty days, 0 stray levels on non-class types, 239 blank titles, 0 role/profile_type mismatches; people types dj/djing 79, teacher/teaching 203, teacher/mc 1, dancer/performing 1; the echo of every listed field across three shapes, with a mutation; the gate-off behaviour by reading every write path; the CI table above.

**Not verified:** no browser walk by the reviewer (author's shots only); no live save (writers are admin-only on prod and must not be called); AW1's server shapes and `organiser_series_cast_v1` (not on prod); whether the admin editor already sends item ids or hits B1 on prod today (admin repo not reachable); real phone.

## Appendix: reviewer test (`review-sw1.echo.test.ts`, run from `src/modules/organiser/events/__tests__/`, not committed)

```ts
// REVIEW-SW1 (reviewer, not shipped): every stored field series.set_program re-inserts
// must come back unchanged for every prod shape, after an unrelated edit.
import { describe, expect, it } from 'vitest';
import { buildDays, parseTree, setPersonRole, updateItem, allItems } from '../programmeSeriesModel';

const P = (id: string, type: string, role: string | null, level: string | null, sort: number) =>
  ({ id: `pp-${id}`, profile_id: id, profile_type: type, role, level, sort_order: sort, display_name: id, avatar_url: null });
const I = (id: string, type: string, extra: Record<string, unknown>, people: unknown[]) => ({
  item: { id, title: `T ${id}`, type, start_time: '19:00:00', end_time: '01:30:00', room: null, venue_room_id: null, level_keys: [],
    style: null, theme: null, track_id: null, parallel_group_id: null, sort_order: 0, ...extra }, people });
const S = (id: string, kind: string, label: string | null, items: unknown[]) => ({ section: { id, kind, sort_order: 0, label_override: label }, items });
const D = (id: string, idx: number, offset: number, label: string | null, sections: unknown[]) => ({ day: { id, day_index: idx, date_offset_days: offset, label, sort_order: idx }, sections });

const FULL = {
  room: 'Studio 2', venue_room_id: '11111111-1111-1111-1111-111111111111', style: 'sensual', theme: 'Footwork',
  track_id: '22222222-2222-2222-2222-222222222222', parallel_group_id: '33333333-3333-3333-3333-333333333333',
};
const SHAPES: Record<string, unknown[]> = {
  'recurring classes+party': [D('d0', 0, 0, null, [
    S('s0', 'classes', null, [I('a', 'class', { ...FULL, level_keys: ['beginner', 'improver'] }, [P('t1', 'teacher', 'teaching', 'beginner', 0)])]),
    S('s1', 'party', null, [I('b', 'party', {}, [P('dj1', 'dj', 'djing', null, 0)])]),
  ])],
  'festival multi-day + labels + parallel': [
    D('d0', 0, 0, 'Friday', [S('s0', 'masterclass', 'Intensives', [I('a', 'masterclass', FULL, []), I('b', 'workshop', { ...FULL, room: 'Hall B' }, [])])]),
    D('d1', 1, 1, 'Saturday', [S('s1', 'showcase', null, [I('c', 'performance', {}, [P('dn1', 'dancer', 'performing', null, 0), P('t2', 'teacher', 'mc', null, 1)])])]),
  ],
  'stored outside types + social': [D('d0', 0, 0, null, [
    S('s0', 'social', 'Late social', [I('a', 'show', FULL, []), I('b', 'competition', {}, [])]),
    S('s1', 'competition', null, [I('c', 'workshop', {}, [])]),
  ])],
};

const strip = (v: unknown) => JSON.parse(JSON.stringify(v));

describe.each(Object.entries(SHAPES))('REVIEW-SW1 echo: %s', (_name, program) => {
  it('an unrelated edit (rename item 0) re-sends every other stored field unchanged', () => {
    const tree = parseTree(program);
    const first = allItems(tree)[0];
    const sent = buildDays(updateItem(tree, first.key, { title: 'Renamed' })) as Array<Record<string, any>>;
    (program as Array<Record<string, any>>).forEach((d, di) => {
      expect(sent[di]).toMatchObject({ day_index: d.day.day_index, date_offset_days: d.day.date_offset_days, label: d.day.label });
      (d.sections as Array<Record<string, any>>).forEach((s, si) => {
        expect(sent[di].sections[si]).toMatchObject({ kind: s.section.kind, label_override: s.section.label_override });
        (s.items as Array<Record<string, any>>).forEach((e, ii) => {
          const got = sent[di].sections[si].items[ii];
          for (const k of ['type', 'start_time', 'end_time', 'room', 'venue_room_id', 'style', 'theme', 'track_id', 'parallel_group_id', 'level_keys']) {
            expect([k, got[k]]).toEqual([k, e.item[k]]);
          }
          if (di + si + ii > 0) expect(got.title).toBe(e.item.title);
          expect(strip(got.people)).toEqual(e.people.map((p: any, pi: number) => ({ profile_id: p.profile_id, profile_type: p.profile_type, role: p.role, level: p.level, sort: pi })));
        });
      });
    });
  });
});

describe('REVIEW-SW1 known gaps (expected to FAIL on d20de737)', () => {
  it('switching a teacher to DJ keeps the profile_type of the profile the id points at', () => {
    const tree = parseTree(SHAPES['recurring classes+party']);
    const it0 = allItems(tree)[0];
    const sent = buildDays(updateItem(tree, it0.key, setPersonRole(it0, 't1', 'djing'))) as any[];
    expect(sent[0].sections[0].items[0].people[0]).toMatchObject({ profile_id: 't1', profile_type: 'teacher' });
  });
  it('an empty stored section survives a save', () => {
    const program = [D('d0', 0, 0, null, [S('s0', 'classes', null, []), S('s1', 'party', null, [I('b', 'party', {}, [])])])];
    const tree = parseTree(program);
    const sent = buildDays(updateItem(tree, allItems(tree)[0].key, { title: 'x' })) as any[];
    expect(sent[0].sections.map((s: any) => s.kind)).toEqual(['classes', 'party']);
  });
  it('the item id is sent, so per-date overrides (FK ON DELETE CASCADE) can survive', () => {
    const tree = parseTree(SHAPES['recurring classes+party']);
    const sent = buildDays(tree) as any[];
    expect(sent[0].sections[0].items[0]).toHaveProperty('id', 'a');
  });
});
```

Output on `d20de737`:
```
 FAIL  ... REVIEW-SW1 known gaps > switching a teacher to DJ keeps the profile_type of the profile the id points at
AssertionError: expected { profile_id: 't1', ...(4) } to match object { profile_id: 't1', ...(1) }
 FAIL  ... REVIEW-SW1 known gaps > an empty stored section survives a save
AssertionError: expected [ 'party' ] to deeply equal [ 'classes', 'party' ]
 FAIL  ... REVIEW-SW1 known gaps > the item id is sent, so per-date overrides (FK ON DELETE CASCADE) can survive
AssertionError: expected { title: 'T a', type: 'class', ...(11) } to have property "id" with value 'a'
      Tests  3 failed | 3 passed (6)
```
Mutation `theme: it.raw.theme ?? null` -> `theme: null` in `buildDays`:
```
 FAIL  ... REVIEW-SW1 echo: recurring classes+party > an unrelated edit (rename item 0) re-sends every other stored field unchanged
 FAIL  ... REVIEW-SW1 echo: festival multi-day + labels + parallel > ...
 FAIL  ... REVIEW-SW1 echo: stored outside types + social > ...
AssertionError: expected [ 'theme', null ] to deeply equal [ 'theme', 'Footwork' ]
      Tests  3 failed | 3 skipped (6)
```
(file restored; `git diff` clean afterwards.)
