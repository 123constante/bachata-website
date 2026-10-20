# W1 slice S0: the ONE people-badges mapping (Website, Sonnet)

Repo: Website (123constante/bachata-website). Branch: `claude/w1-s0-badges`, created FROM `origin/main`. This is a SUB-BRANCH of the W1 PR: push the branch, do NOT open a PR (the orchestrator merges S0 + S1-S4 locally into one W1 PR).

## Why
People appear on 6 public surfaces (/dancers, /djs, dancer page, DJ page, organiser team strip, event lineup, search). Today each decides labels, names and links on its own, and /dancers + the organiser strip know nothing about roles. The owner approved one shared mapping that every surface uses (no second copy). Slices S1 (lists), S2 (role pages), S3 (strips + search) start FROM your branch after you push, so the interface below is PINNED: do not rename or change signatures.

## Data (already live on prod, read-only)
Admin RPC `get_public_people_badges_v1(p_ids uuid[]) RETURNS jsonb`, anon-callable, max 300 ids per call. Measured on prod 2026-10-20: returns an array of `{id, roles, dj_name, next_gig_date, dj_has_upcoming}`; for the 40 ids of `list_public_djs_v1` it returned 40 rows, 17 with `dj_has_upcoming=true`. DJ page ids (`/djs/:id`) and dancer ids are the same person id (the DJ list ids were accepted by the badges RPC). `roles` are `person_roles` values (`dancing`, `djing`, `teaching`, plus non-public ones such as `organising`, `filming`, `performing`). Check the exact JSON shape yourself with ONE read-only call (Supabase MCP `execute_sql`: `select public.get_public_people_badges_v1(array(select id from public.dancer_profiles limit 5))`) and write it into the handover.

## Owner decisions this encodes (binding)
- Vocabulary: the nouns "Dancer", "DJ", "Teacher" everywhere. Reuse `ROLE_LABEL`, `ROLE_ORDER`, `PersonRole` from `src/lib/searchEntities.ts` (it already says Teacher/DJ/Dancer). Never write those strings a second time.
- Name rule: the stage name (`dj_name`) leads on DJ things (DJ list, DJ page, lineup DJ slots, the DJ tag); the real name everywhere else.
- Teacher pages are OFF (`flags.teacherDetail` in `src/lib/featureFlags.ts`). While off: the Teacher tag still SHOWS, as plain text, with `href: null`; nothing ever links to `/teachers/`.
- Links never dead-end: DJ page if the person DJs, else the dancer page if they dance, else the teacher page only if the flag is on, else no link.
- Lead role: a DJ with an upcoming gig leads; otherwise dancing leads; otherwise DJ; otherwise teacher.
- Roles are always public.

## PINNED interface: new `src/modules/person-page/badges.ts`
```ts
import type { PersonRole } from '@/lib/searchEntities';
export type PersonBadge = { id: string; roles: PersonRole[]; djName: string | null; djHasUpcoming: boolean; nextGigDate: string | null };
export type RoleTag = { role: PersonRole; label: string; href: string | null };
export type BadgeOpts = { teacherPagesOpen: boolean };
/** dancing->dancer, djing->dj, teaching->teacher; other roles dropped; ordered by ROLE_ORDER; tolerant of null/garbage. */
export function parseBadges(raw: unknown): Map<string, PersonBadge>;
/** Fetches in chunks of 300 (dedupe + sort ids for the cache key), react-query like the existing reads in reads.ts. Empty ids = no request. */
export function usePeopleBadges(ids: readonly string[]): { badges: Map<string, PersonBadge>; isLoading: boolean };
export function hrefForRole(role: PersonRole, id: string, opts: BadgeOpts): string | null; // /djs/:id, /dancers/:id, /teachers/:id only when open
/** One tag per role in ROLE_ORDER. withStageName: the DJ tag reads "DJ · <djName>" when djName is set (Also bar, search). exclude: the role of the page you are on. */
export function roleTagsFor(badge: PersonBadge, opts: BadgeOpts & { withStageName?: boolean; exclude?: PersonRole }): RoleTag[];
export function nameFor(context: 'dj' | 'other', person: { name: string; djName?: string | null }): string;
export function linkFor(badge: PersonBadge | undefined, opts: BadgeOpts): string | null;
export function leadRole(badge: PersonBadge): PersonRole | null;
```
Use the existing hrefs/URL helpers (`hrefFor` in `searchEntities.ts`, `ROLE_PAGE_BASE` in `personRoles.ts`) instead of new string building where they fit. Touch no other file except: a test file, and (only if needed) an export added to `searchEntities.ts` without changing any existing value.

## Tests (table-driven, `src/modules/person-page/__tests__/badges.test.ts`)
Shapes x functions, every row asserting label set, link and name: dancer-only; DJ-only with gig; DJ-only without gig; DJ+dancer with gig; DJ+dancer without gig; dancer+teacher; teacher-only; DJ whose djName starts with "DJ" (label still "DJ · DJ X" with stage name, plain "DJ" without); djName null; empty roles; unknown roles only (organising); garbage input to parseBadges. Each shape run with teacherPagesOpen false AND true. Invariants asserted across the whole table: no href starts with `/teachers/` while closed; every label is a ROLE_LABEL value (or "DJ · ..."); linkFor is null exactly when no linkable role. Prove the test bites: apply 3 rolled-back mutants (teacher href while closed; dancer before DJ in linkFor; stage name used in 'other' context), show each test run RED, revert, show GREEN; put the commands + results in the handover.

Prod shapes survey (read-only, counts only, no names): how many public people per role combination; DJs with/without upcoming; djName differs from name; djName starting "DJ"; teacher-only. Put the counts in the handover; S1-S3 will reuse them.

## Gates (run ALL, put a per-job table with command + exit code in the handover)
Read `.github/workflows/*.yml` and run every job step that can run in your sandbox (lint, typecheck, unit tests, `npm run build` PRODUCTION build). GitHub Actions may refuse jobs with a "payments have failed / spending limit" annotation: that is billing, not code; your table is the evidence. Docker / local Supabase / real phone: say NOT RUN and why.

## Rules
- Plain git only (`git fetch`, `git show`, `git push`); NEVER `gh api`. Commands without variables, loops or `$(...)` where a plain command works.
- Supabase READ-ONLY (SELECT only). Never touch `.github/workflows`, `.env*`, secrets.
- Push ONCE at the end (Vercel deploy cap). Last commit subject ends `[worker-done <ticket>]`.
- 30% context rule: at 25% start nothing new; by 30% push work + handover with a last subject ending `PARTIAL [worker-done <ticket>]`. A continuation worker on the same branch reads your handover; that is normal.
- Handover file: `docs/handover/w1-s0-badges.md` (done / measured / left / NOT verified).
- Never merge, approve, or open a PR. Stop after the push.

PR BATCHING (docs/pr-batching-policy.md, adapted: sub-branch, no PR)
- ONE branch for this job. Push ONCE when finished. Fix your own mistakes on this branch.
- Docs / handover / test-only changes belong on this branch.
- Bug fix shape? include the test that would have caught it, shown failing first.
- Never merge or approve. Stop after the push and report.
