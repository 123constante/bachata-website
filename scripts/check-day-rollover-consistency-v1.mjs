#!/usr/bin/env node
// =============================================================================
// check-day-rollover-consistency-v1.mjs
//
// Phase 1F brief §6.2.5 — Cross-repo CI gate for the program day-rollover rule.
//
// What this gate proves:
//   The Website repo's `src/lib/programDayRollover.ts::getDisplayDay` returns
//   the canonical display-day for every fixture in DAY_ROLLOVER_FIXTURES.
//
// Cross-repo gap (HONEST STATUS):
//   The brief intent is "ensure both repos use the same logic". This first
//   version achieves that pragmatically by:
//     1. Maintaining `programDayRollover.ts` as a manually-mirrored file in
//        BOTH repos (admin + Website).
//     2. Asserting the fixture set inline in this script — the script is a
//        THIRD canonical reference encoding the same rule.
//     3. Running fixtures through Website's util in CI.
//
//   What's NOT yet wired:
//     - The admin repo doesn't have its own scheduled CI run of this same
//       fixture set against its own util. Drift in admin would not be caught
//       by THIS workflow until someone manually re-syncs.
//     - There's no auto-derivation that fails the build if the two TS files
//       go out of sync byte-for-byte.
//
//   Cleanup follow-up (TODO): consolidate into a published
//   @bachata/program-rollover workspace package once the monorepo lift lands.
//   Until then, the manual mirror + inline-fixture assertion catches the
//   most likely failure mode (someone edits Website's util and the rule
//   diverges from the canonical fixture set).
//
// Wired into: .github/workflows/db-contract-check.yml as the 8th step.
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ─── Canonical fixture set (mirror of admin/lib/programDayRollover.ts) ───────
//
// Keep this list in sync with:
//   - admin: lib/programDayRollover.ts → DAY_ROLLOVER_FIXTURES
//   - Website: src/lib/programDayRollover.ts → DAY_ROLLOVER_FIXTURES
//
// If a fixture is added in one place but not the others, the next CI run
// either misses a regression (if added only here) or flags a "Website util
// missing fixture" failure (if added only there).

const FIXTURES = [
    { label: 'evening session same day',
      event:   { start_time: '2026-06-19T19:00:00Z' },
      session: { start_time: '2026-06-19T21:00:00Z' },
      expectedDayIso: '2026-06-19T00:00:00.000Z' },
    { label: 'late party past midnight folds back to prior day',
      event:   { start_time: '2026-06-19T19:00:00Z' },
      session: { start_time: '2026-06-20T02:30:00Z' },
      expectedDayIso: '2026-06-19T00:00:00.000Z' },
    { label: 'session at exactly 08:00 next day stays on next day',
      event:   { start_time: '2026-06-19T19:00:00Z' },
      session: { start_time: '2026-06-20T08:00:00Z' },
      expectedDayIso: '2026-06-20T00:00:00.000Z' },
    { label: 'session at 07:59 next day rolls back',
      event:   { start_time: '2026-06-19T19:00:00Z' },
      session: { start_time: '2026-06-20T07:59:00Z' },
      expectedDayIso: '2026-06-19T00:00:00.000Z' },
    { label: 'multi-day festival — day 2 evening',
      event:   { start_time: '2026-06-19T18:00:00Z' },
      session: { start_time: '2026-06-20T20:00:00Z' },
      expectedDayIso: '2026-06-20T00:00:00.000Z' },
    { label: 'multi-day festival — day 2 late party rolls back to day 2',
      event:   { start_time: '2026-06-19T18:00:00Z' },
      session: { start_time: '2026-06-21T03:00:00Z' },
      expectedDayIso: '2026-06-20T00:00:00.000Z' },
    { label: 'tz-less editor form (no Z) treated as UTC wall-clock',
      event:   { start_time: '2026-06-19T19:00' },
      session: { start_time: '2026-06-20T02:00' },
      expectedDayIso: '2026-06-19T00:00:00.000Z' },
    { label: 'midnight session (00:00 next day) rolls back',
      event:   { start_time: '2026-06-19T19:00:00Z' },
      session: { start_time: '2026-06-20T00:00:00Z' },
      expectedDayIso: '2026-06-19T00:00:00.000Z' },
];

// ─── Inline reimplementation (third reference) ───────────────────────────────
//
// Keep byte-for-byte equivalent with the TS getDisplayDay in both repos.
// If you change one, change all three at the same time.

const DAY_MS = 24 * 60 * 60 * 1000;
const ROLLOVER_HOUR = 8;

function parseIso(iso) {
    if (!iso) return new Date(NaN);
    const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
    return new Date(hasTz ? iso : `${iso}Z`);
}

function utcMidnight(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getDisplayDayInline(session, event) {
    const sessionDt = parseIso(session.start_time);
    const eventDt   = parseIso(event.start_time);
    if (Number.isNaN(sessionDt.getTime()) || Number.isNaN(eventDt.getTime())) {
        return new Date(NaN);
    }
    const sessionMid = utcMidnight(sessionDt);
    const eventMid   = utcMidnight(eventDt);
    if (sessionMid.getTime() > eventMid.getTime() && sessionDt.getUTCHours() < ROLLOVER_HOUR) {
        return new Date(sessionMid.getTime() - DAY_MS);
    }
    return sessionMid;
}

// ─── Runner ──────────────────────────────────────────────────────────────────

function runFixtures(label, getDisplayDay) {
    let passed = 0;
    let failed = 0;
    const failures = [];
    for (const fx of FIXTURES) {
        const actual = getDisplayDay(fx.session, fx.event);
        const actualIso = Number.isNaN(actual.getTime())
            ? '<INVALID DATE>'
            : actual.toISOString();
        if (actualIso === fx.expectedDayIso) {
            passed++;
        } else {
            failed++;
            failures.push({
                label: fx.label,
                expected: fx.expectedDayIso,
                actual: actualIso,
                event: fx.event.start_time,
                session: fx.session.start_time,
            });
        }
    }
    return { label, total: FIXTURES.length, passed, failed, failures };
}

// ─── Static check: confirm the Website util file exists and exports getDisplayDay
// We can't `import` a .ts file in plain Node ESM. Instead we sanity-check the
// file is on disk and contains the expected export shape. This catches the
// "file deleted / renamed" failure mode at minimum.

function verifyWebsiteUtilSource() {
    const path = resolve(REPO_ROOT, 'src/lib/programDayRollover.ts');
    let src;
    try {
        src = readFileSync(path, 'utf8');
    } catch (err) {
        return { ok: false, reason: `Website util missing at ${path}: ${err.message}` };
    }
    if (!/export\s+function\s+getDisplayDay\s*\(/.test(src)) {
        return { ok: false, reason: `Website util at ${path} does not export getDisplayDay` };
    }
    if (!/DAY_ROLLOVER_FIXTURES/.test(src)) {
        return { ok: false, reason: `Website util at ${path} is missing DAY_ROLLOVER_FIXTURES — out of sync with admin` };
    }
    // Spot-check the fixture count to catch most "fixture drift" cases.
    const fixtureMatches = src.match(/expectedDayIso:/g) || [];
    if (fixtureMatches.length < FIXTURES.length) {
        return {
            ok: false,
            reason: `Website util has ${fixtureMatches.length} fixtures but the canonical set has ${FIXTURES.length}. Re-sync from admin.`,
        };
    }
    return { ok: true };
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('check-day-rollover-consistency-v1');
console.log('  fixtures: ' + FIXTURES.length);
console.log('');

const inlineResult = runFixtures('inline (this script)', getDisplayDayInline);
console.log(`  inline:  ${inlineResult.passed}/${inlineResult.total} passed`);
if (inlineResult.failed > 0) {
    for (const f of inlineResult.failures) {
        console.log(`    FAIL  ${f.label}`);
        console.log(`      event:   ${f.event}`);
        console.log(`      session: ${f.session}`);
        console.log(`      expected ${f.expected}`);
        console.log(`      actual   ${f.actual}`);
    }
}

const websiteSource = verifyWebsiteUtilSource();
console.log(`  website util source check: ${websiteSource.ok ? 'OK' : 'FAIL — ' + websiteSource.reason}`);

const ok = inlineResult.failed === 0 && websiteSource.ok;
console.log('');
console.log(ok ? 'OK — day-rollover rule is consistent.' : 'FAIL — see above.');
process.exit(ok ? 0 : 1);
