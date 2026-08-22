#!/usr/bin/env node
/**
 * apply-firewall.mjs -- apply the committed vercel-firewall.json to the live
 * Vercel Edge/WAF config, one changed field at a time, via Vercel's own
 * {action, id, value} PATCH envelope. Modelled on
 * bachata-admin-11april/scripts/apply-migration.mjs's discipline (read from
 * disk, --dry-run rehearsal, REFUSE rather than warn) and reusing the
 * VERCEL_TOKEN / VERCEL_PROJECT / VERCEL_TEAM_ID pattern already established
 * by scripts/fetch-vercel-build-log.mjs.
 *
 * VERIFIED LIVE 2026-08-22 against project prj_KVXvwOmB4SDFy3HljJqXVgiq6APq
 * (a real insert, update and remove of a throwaway custom rule matched on a
 * path nobody serves, immediately reverted; the same cycle re-run once more
 * through THIS script's own --dry-run / apply / re-confirm path):
 *   managedRules.update  {action:'managedRules.update', id:<key>, value:{active,action}}
 *                         -- this is P0's own shape, re-confirmed by reading
 *                         the live config rather than re-tested destructively.
 *   rules.insert          {action:'rules.insert', value:{name,active,description,
 *                          conditionGroup,action}}  -- no id in value; Vercel assigns one,
 *                          and does not return it (empty `{}` response body) -- see
 *                          reconcileInsertedRules() in scripts/lib/firewall-config.mjs.
 *   rules.update           {action:'rules.update', id:<ruleId>, value:{name,active,
 *                          description,conditionGroup,action}}  -- value must NOT carry
 *                          id/valid/validationErrors: a value shaped like the GET
 *                          response 400s ("`action` should be equal to constant").
 *   rules.remove            {action:'rules.remove', id:<ruleId>}
 * All four returned HTTP 200 with an empty `{}` body; the effect was
 * confirmed by re-reading /config/active, not by trusting the response.
 *
 * NOT VERIFIED: crs.update. Probed the same day with
 *   {action:'crs.update', id:'sd', value:{active:true,action:'log'}}
 * against the currently-inactive 'sd' CRS category (action stays 'log' --
 * detection only, nothing to mitigate) and it 401'd with "OWASP Core Ruleset
 * must be enabled to modify CRS rules". That is a PLAN/FEATURE gate on this
 * project, not a shape problem -- the envelope below follows the same
 * {action,id,value} pattern as managedRules.update by analogy, untested. This
 * script REFUSES a crs.* diff rather than attempt an unverified mutation
 * against production.
 *
 * NOT IMPLEMENTED: firewallEnabled and ips, and a managedRules key present on
 * one side only (Vercel does not obviously support "removing" a built-in
 * managed-rule category). None of these ever changed between the captured
 * baseline and any config probed while building this script, so no PATCH
 * action shape for any of them was ever exercised. A diff naming one refuses
 * with the same message, rather than guessing an action name.
 *
 * USAGE
 *   node scripts/apply-firewall.mjs --dry-run
 *   node scripts/apply-firewall.mjs
 *   node scripts/apply-firewall.mjs --allow-destructive
 *   node scripts/apply-firewall.mjs --self-test
 *
 * REFUSES, NEVER WARNS -- in both --dry-run and apply mode, because a
 * rehearsal that hides a refusal is not a rehearsal:
 *   - any diff that would leave managedRules.bot_protection BOTH active AND
 *     set to "challenge". Re-arming Bot Protection is gated to arc phase P6
 *     (edge-config-governance), after the consumer inventory (P4) and the
 *     probe fixes (P5) exist. THERE IS NO OVERRIDE FLAG for this one --
 *     unlike the destructive gate below, it cannot be argued past. Checking
 *     `active` as well as `action` matters: a committed file that DISABLES a
 *     wrongly-armed bot_protection rule (active:false, action left at
 *     'challenge' -- the natural minimal edit for exactly the 2026-08-21
 *     incident this arc exists to prevent recurrence of) must not trip this.
 *   - firewallEnabled -> false, or removing/disabling ANY custom rule --
 *     needs --allow-destructive (apply-migration.mjs's own pattern:
 *     CLAUDE.md requires a human heads-up before a destructive prod change;
 *     this makes it mechanical rather than remembered). Not scoped to the
 *     one rule that exists today (an earlier draft matched "Bypass
 *     revalidate webhook" by name; a second rule from P4/P6 would have
 *     shipped ungated).
 *   - any crs.* diff (unverified transport, see above).
 *   - any firewallEnabled/ips/managedRules-structural diff (no verified
 *     transport at all, see above).
 *
 * Credentials: VERCEL_TOKEN lives in .env.local locally / a repo secret in
 * CI -- never written to vercel-firewall.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import {
  canonicalizeConfig,
  diffConfig,
  formatFinding,
  isPlausibleLiveConfig,
  reconcileInsertedRules,
  resolveVercelEnv,
  resolveProjectId,
  fetchActiveConfig,
  patchFirewallConfig,
} from './lib/firewall-config.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMMITTED_PATH = path.join(ROOT, 'vercel-firewall.json');

const BOT_PROTECTION_REFUSAL =
  'REFUSED -- this diff would leave managedRules.bot_protection ACTIVE and set to ' +
  '"challenge". Re-arming Bot Protection is gated to arc phase P6 (edge-config-governance), ' +
  'after the consumer inventory (P4) and the probe fixes (P5) exist. This script has no ' +
  'override flag for it; that is deliberate. If vercel-firewall.json says "challenge" while ' +
  'active, the file is wrong for this phase, not this refusal.';

/**
 * True only when applying `committed` would leave bot_protection BOTH active
 * AND in challenge mode -- checking `action` alone refused the exact
 * emergency-fix shape this arc exists to enable: a committed file that sets
 * active:false to disable a wrongly-armed rule, with `action` left untouched
 * at 'challenge' because there is no reason to also rewrite a moot field.
 */
export function wouldChallengeBotProtection(committed) {
  const bp = committed?.managedRules?.bot_protection;
  return bp?.active === true && bp?.action === 'challenge';
}

/**
 * Destructive-looking diffs, named for the refusal message. Does not decide
 * whether they are ALLOWED -- only whether they exist. `live` resolves a
 * rule's NAME for a field-level `.active` finding, whose own committed/live
 * values are plain booleans, not rule objects.
 *
 * Generalised over EVERY custom rule, not just "Bypass revalidate webhook"
 * by name -- an earlier version matched only that one rule, so a second
 * custom rule (P4/P6 will add some) would have had its removal OR its
 * disabling ship with no gate at all.
 */
export function findDestructive(findings, live) {
  const hits = [];
  const ruleName = (id) => live?.rules?.find((r) => r.id === id)?.name ?? id;
  for (const f of findings) {
    if (f.path === 'firewallEnabled' && f.committed === false) {
      hits.push('firewallEnabled -> false');
      continue;
    }
    const m = /^rules\[(.+?)\](?:\.(.+))?$/.exec(f.path);
    if (!m) continue;
    const [, id, field] = m;
    if (field === undefined && f.committed === null && f.live) {
      hits.push(`removing custom rule "${f.live.name}"`);
    } else if (field === 'active' && f.committed === false) {
      hits.push(`disabling custom rule "${ruleName(id)}" (active -> false)`);
    }
  }
  return hits;
}

/** The authored fields of a custom rule, in the shape rules.insert/update
 *  accept as `value` -- NOT the shape a GET returns (no id, no
 *  valid/validationErrors; sending those 400s, verified live -- see header). */
function ruleValuePayload(rule) {
  return {
    name: rule.name,
    active: rule.active,
    description: rule.description,
    conditionGroup: rule.conditionGroup,
    action: rule.action,
  };
}

/** Every distinct managedRules key touched by a FIELD-level finding
 *  (`.active`/`.action`), in order of first appearance -- so a key with both
 *  diffs gets exactly ONE PATCH, not two. Excludes whole-key structural
 *  findings (`managedRules.<key>` with no field suffix): those mean the key
 *  exists on only one side, which main()'s unsupported-field gate refuses
 *  before this ever runs. */
function managedRuleKeys(findings) {
  const keys = [];
  for (const f of findings) {
    const m = /^managedRules\.([^.]+)\.(active|action)$/.exec(f.path);
    if (m && !keys.includes(m[1])) keys.push(m[1]);
  }
  return keys;
}

/** Every distinct rule id touched by `findings`, in order of first
 *  appearance. Regex, not slice-and-strip: `rules[id].field` and the
 *  whole-object `rules[id]` (added/removed) both anchor on the SAME bracket
 *  pair, and a hand-rolled prefix strip left a trailing `]` glued onto the
 *  id on the first attempt at this. */
function ruleIds(findings) {
  const ids = [];
  for (const f of findings) {
    const m = /^rules\[(.+?)\]/.exec(f.path);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

async function applyManagedRules(ctx, findings, out) {
  for (const key of managedRuleKeys(findings)) {
    const target = ctx.committed.managedRules[key];
    await patchFirewallConfig(ctx.fetchImpl, ctx.token, ctx.projectId, ctx.teamId, {
      action: 'managedRules.update',
      id: key,
      value: { active: target.active, action: target.action },
    });
    out(`  applied managedRules.${key} -> ${JSON.stringify(target)}`);
  }
}

/** @returns {string[]} the COMMITTED placeholder ids this run inserted --
 *  Vercel assigns its own id and never returns it, so the caller cannot
 *  confirm these by id; see reconcileInsertedRules(). */
async function applyRules(ctx, findings, out) {
  const liveIds = new Set(ctx.live.rules.map((r) => r.id));
  const inserted = [];
  for (const id of ruleIds(findings)) {
    const committedRule = ctx.committed.rules.find((r) => r.id === id);
    if (committedRule && !liveIds.has(id)) {
      await patchFirewallConfig(ctx.fetchImpl, ctx.token, ctx.projectId, ctx.teamId, {
        action: 'rules.insert',
        value: ruleValuePayload(committedRule),
      });
      inserted.push(id);
      out(`  applied rules.insert for ${id} (${committedRule.name}) -- Vercel assigns its own id`);
    } else if (!committedRule) {
      await patchFirewallConfig(ctx.fetchImpl, ctx.token, ctx.projectId, ctx.teamId, {
        action: 'rules.remove',
        id,
      });
      out(`  applied rules.remove for ${id}`);
    } else {
      await patchFirewallConfig(ctx.fetchImpl, ctx.token, ctx.projectId, ctx.teamId, {
        action: 'rules.update',
        id,
        value: ruleValuePayload(committedRule),
      });
      out(`  applied rules.update for ${id} (${committedRule.name})`);
    }
  }
  return inserted;
}

export async function main(argv = [], deps = {}) {
  const {
    out = console.log,
    err = console.error,
    env = process.env,
    fetchImpl = fetch,
    readCommitted = () => fs.readFileSync(COMMITTED_PATH, 'utf8'),
  } = deps;
  if (argv.includes('--self-test')) {
    const passed = await selfTest();
    return passed ? 0 : 1;
  }
  const dryRun = argv.includes('--dry-run');
  const allowDestructive = argv.includes('--allow-destructive');

  const { token, project, teamId } = resolveVercelEnv(env);
  if (!token) {
    err('VERCEL_TOKEN is not set. Create one at https://vercel.com/account/settings/tokens ' +
      '(read scope for --dry-run; a token that can write firewall config to apply).');
    return 2;
  }

  let committedRaw;
  try {
    committedRaw = JSON.parse(readCommitted());
  } catch (error) {
    err(`cannot read/parse vercel-firewall.json: ${error.message}`);
    return 2;
  }
  const committed = canonicalizeConfig(committedRaw);

  let projectId;
  try {
    projectId = await resolveProjectId(fetchImpl, token, project, teamId);
  } catch (error) {
    err(`could not resolve project "${project}": ${error.message}`);
    return 2;
  }

  let liveRaw;
  try {
    liveRaw = await fetchActiveConfig(fetchImpl, token, projectId, teamId);
  } catch (error) {
    err(`could not fetch live firewall config: ${error.message}`);
    return 2;
  }
  if (!isPlausibleLiveConfig(liveRaw)) {
    err('live config fetch returned no managedRules -- cannot tell "no diff" from an empty read.');
    return 2;
  }
  const live = canonicalizeConfig(liveRaw);
  let findings;
  try {
    findings = diffConfig(committed, live);
  } catch (error) {
    err(error.message);
    return 2;
  }

  out(`apply-firewall: ${dryRun ? 'DRY RUN' : 'APPLY'} against project ${project} (${projectId})`);
  if (findings.length === 0) {
    out('  no diff -- live config already matches vercel-firewall.json');
    return 0;
  }
  out(`  ${findings.length} field(s) differ:`);
  for (const f of findings) out('    ' + formatFinding(f));

  if (wouldChallengeBotProtection(committed) &&
      findings.some((f) => f.path.startsWith('managedRules.bot_protection'))) {
    err('\n' + BOT_PROTECTION_REFUSAL);
    return 1;
  }

  const destructive = findDestructive(findings, live);
  if (destructive.length && !allowDestructive) {
    err(`\nREFUSED -- destructive-looking change(s): ${destructive.join('; ')}. ` +
      'Re-run with --allow-destructive once Ricky has confirmed.');
    return 1;
  }

  const crsHits = findings.filter((f) => f.path.startsWith('crs.'));
  if (crsHits.length) {
    err(`\nREFUSED -- crs.* field(s) differ (${crsHits.map((f) => f.path).join(', ')}) but ` +
      'crs.update is UNVERIFIED against a live-enabled OWASP Core Ruleset (probed ' +
      '2026-08-22: 401 "OWASP Core Ruleset must be enabled to modify CRS rules"). Apply ' +
      'these manually via the Vercel dashboard, or verify the transport first.');
    return 1;
  }

  // firewallEnabled/ips (no transport ever exercised) AND a managedRules key
  // present on only one side (structural: `managedRules.<key>` with no
  // trailing field -- Vercel does not obviously support "removing" a
  // built-in category, and applyManagedRules() cannot represent that PATCH).
  const unsupported = findings.filter(
    (f) => f.path === 'firewallEnabled' || f.path === 'ips' || /^managedRules\.[^.]+$/.test(f.path),
  );
  if (unsupported.length) {
    err(`\nREFUSED -- no verified PATCH action exists for: ${unsupported.map((f) => f.path).join(', ')}. ` +
      'Apply manually via the Vercel dashboard, then re-run --dry-run to confirm.');
    return 1;
  }

  if (dryRun) {
    out('\nDRY RUN -- nothing applied.');
    return 0;
  }

  out('\napplying...');
  const ctx = { fetchImpl, token, projectId, teamId, committed, live };
  let insertedPlaceholders = [];
  try {
    await applyManagedRules(ctx, findings, out);
    insertedPlaceholders = await applyRules(ctx, findings, out);
  } catch (error) {
    err(`\napply-firewall: FAILED mid-apply -- ${error.message}. Re-run --dry-run to see the ` +
      'current state; some fields may already be applied.');
    return 1;
  }

  let liveAfterRaw;
  try {
    liveAfterRaw = await fetchActiveConfig(fetchImpl, token, projectId, teamId);
  } catch (error) {
    err(`\napplied, but could not re-read to confirm: ${error.message}`);
    return 2;
  }
  if (!isPlausibleLiveConfig(liveAfterRaw)) {
    err('\napplied, but the re-read returned no managedRules -- cannot confirm the apply against ' +
      'a read that measured nothing. Re-run --dry-run once the API is answering normally.');
    return 2;
  }
  let liveAfter;
  let remaining;
  try {
    liveAfter = canonicalizeConfig(liveAfterRaw);
    remaining = diffConfig(committed, liveAfter);
  } catch (error) {
    err(`\napplied, but could not confirm: ${error.message}`);
    return 2;
  }
  if (insertedPlaceholders.length) {
    const reconciled = reconcileInsertedRules(committed.rules, liveAfter.rules, insertedPlaceholders, remaining);
    remaining = reconciled.remaining;
    for (const note of reconciled.notes) out('  ' + note);
  }
  if (remaining.length > 0) {
    err(`\napply-firewall: applied, but ${remaining.length} field(s) STILL differ after re-read:`);
    for (const f of remaining) err('  ' + formatFinding(f));
    return 1;
  }
  out('\napply-firewall: applied and confirmed -- live config now matches vercel-firewall.json exactly.');
  return 0;
}

// ---------------------------------------------------------------------------
// Canary. Not required by check-script-conventions.mjs's R1-R5 (those scan
// only scripts/check-*.mjs and lint-*.mjs) -- added anyway: this script
// mutates PROD, review found it had zero automated coverage, and a
// regression would only surface when a human next ran it against production
// with a real token.
// ---------------------------------------------------------------------------

const FIXTURE_COMMITTED_RAW = {
  managedRules: {
    ai_bots: { active: true, action: 'deny' },
    bot_protection: { active: true, action: 'log' },
  },
  crs: { sqli: { active: true, action: 'log' } },
  rules: [
    {
      id: 'rule_x',
      name: 'Bypass',
      active: true,
      description: 'd',
      conditionGroup: [{ conditions: [{ type: 'path', op: 'eq', value: '/api/x' }] }],
      action: { mitigate: { action: 'bypass', redirect: null, rateLimit: null, actionDuration: null } },
    },
  ],
  ips: [],
  firewallEnabled: true,
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

/** A stateful fixture: PATCHes actually mutate `state.live`, the same way
 *  Vercel's API does, including assigning a FRESH id on rules.insert and
 *  never returning it -- the exact behaviour reconcileInsertedRules exists
 *  to reconcile. */
function makeFetchState(liveRaw, opts = {}) {
  let insertCounter = 0;
  const state = { live: clone(liveRaw) };
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/v9/projects/')) {
      if (opts.projectFails) return resp(401, { error: { message: 'bad token' } });
      return resp(200, { id: 'prj_test' });
    }
    if (u.includes('/v1/security/firewall/config/active')) {
      if (opts.activeThrows) throw new Error('network down');
      if (opts.activeFails) return resp(500, { error: { message: 'server error' } });
      return resp(200, state.live);
    }
    if (u.includes('/v1/security/firewall/config')) {
      const { action, id, value } = JSON.parse(init.body);
      state.live.rules = state.live.rules ?? [];
      if (action === 'managedRules.update') {
        state.live.managedRules[id] = { active: value.active, action: value.action };
      } else if (action === 'rules.insert') {
        insertCounter += 1;
        state.live.rules.push({ id: `rule_generated_${insertCounter}`, ...value });
      } else if (action === 'rules.update') {
        const idx = state.live.rules.findIndex((r) => r.id === id);
        if (idx >= 0) state.live.rules[idx] = { id, ...value };
      } else if (action === 'rules.remove') {
        state.live.rules = state.live.rules.filter((r) => r.id !== id);
      }
      return resp(200, {});
    }
    throw new Error('unexpected url in fixture: ' + u);
  };
  return { state, fetchImpl };
}

const cases = [];
const add = (name, run, expected) => cases.push({ name, run, expected });

// --- Pure functions ---
add('wouldChallengeBotProtection: active+challenge refuses',
  () => wouldChallengeBotProtection({ managedRules: { bot_protection: { active: true, action: 'challenge' } } }), true);
add('wouldChallengeBotProtection: DISABLING a challenge rule (active:false) does NOT refuse',
  () => wouldChallengeBotProtection({ managedRules: { bot_protection: { active: false, action: 'challenge' } } }), false);
add('wouldChallengeBotProtection: active+log does not refuse',
  () => wouldChallengeBotProtection({ managedRules: { bot_protection: { active: true, action: 'log' } } }), false);
add('findDestructive: removing any custom rule is destructive, not just the named one',
  () => findDestructive(
    [{ path: 'rules[rule_y]', committed: null, live: { name: 'Some other rule' } }],
    { rules: [] },
  ).length, 1);
add('findDestructive: disabling a custom rule (active->false) is destructive',
  () => findDestructive(
    [{ path: 'rules[rule_x].active', committed: false, live: true }],
    { rules: [{ id: 'rule_x', name: 'Bypass' }] },
  ).length, 1);
add('findDestructive: a non-destructive field change is not flagged',
  () => findDestructive([{ path: 'rules[rule_x].description', committed: 'a', live: 'b' }], { rules: [] }).length, 0);

// --- main(), against a stateful fetch fixture ---
const runMain = (argv, liveRaw, { opts, committedRaw, envOverrides } = {}) => {
  const { fetchImpl } = makeFetchState(liveRaw ?? FIXTURE_COMMITTED_RAW, opts);
  return main(argv, {
    env: { VERCEL_TOKEN: 'tok', ...envOverrides },
    fetchImpl,
    readCommitted: opts?.readCommittedThrows
      ? () => { throw new Error('disk gone'); }
      : () => JSON.stringify(committedRaw ?? FIXTURE_COMMITTED_RAW),
    out: () => {}, err: () => {},
  });
};

add('missing VERCEL_TOKEN is exit 2', () => runMain([], null, { envOverrides: { VERCEL_TOKEN: '' } }), 2);
add('unreadable vercel-firewall.json is exit 2', () => runMain([], null, { opts: { readCommittedThrows: true } }), 2);
add('cannot resolve project id is exit 2', () => runMain([], null, { opts: { projectFails: true } }), 2);
add('live fetch HTTP failure is exit 2', () => runMain([], null, { opts: { activeFails: true } }), 2);
add('live config with null managedRules is exit 2, not a thrown TypeError',
  () => runMain([], { ...clone(FIXTURE_COMMITTED_RAW), managedRules: null }), 2);
add('two committed rules sharing an id is exit 2, not silent shadowing', () => {
  const dup = clone(FIXTURE_COMMITTED_RAW);
  dup.rules.push({ ...clone(dup.rules[0]), name: 'Duplicate id' });
  return runMain([], clone(FIXTURE_COMMITTED_RAW), { committedRaw: dup });
}, 2);
add('identical live config is exit 0, nothing applied', () => runMain(['--dry-run'], clone(FIXTURE_COMMITTED_RAW)), 0);
add('a harmless diff on --dry-run is exit 0 and applies nothing', () => {
  const live = clone(FIXTURE_COMMITTED_RAW);
  live.rules[0].description = 'different on live';
  return runMain(['--dry-run'], live);
}, 0);
add('a diff that would leave bot_protection active+challenge is REFUSED with no override', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.managedRules.bot_protection.action = 'challenge';
  const live = clone(FIXTURE_COMMITTED_RAW);
  return runMain(['--allow-destructive'], live, { committedRaw: committed });
}, 1);
add('a diff that DISABLES a challenge-mode bot_protection is NOT refused by the bot-protection gate', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.managedRules.bot_protection = { active: false, action: 'challenge' };
  const live = clone(FIXTURE_COMMITTED_RAW);
  live.managedRules.bot_protection = { active: true, action: 'challenge' };
  return runMain([], live, { committedRaw: committed });
}, 0);
add('removing a custom rule without --allow-destructive is REFUSED', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.rules = [];
  return runMain([], clone(FIXTURE_COMMITTED_RAW), { committedRaw: committed });
}, 1);
add('removing a custom rule WITH --allow-destructive applies and confirms', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.rules = [];
  return runMain(['--allow-destructive'], clone(FIXTURE_COMMITTED_RAW), { committedRaw: committed });
}, 0);
add('a crs.* diff is REFUSED (unverified transport)', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.crs.sqli.active = false;
  return runMain([], clone(FIXTURE_COMMITTED_RAW), { committedRaw: committed });
}, 1);
add('a firewallEnabled diff is REFUSED (no verified transport)', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.firewallEnabled = false;
  return runMain(['--allow-destructive'], clone(FIXTURE_COMMITTED_RAW), { committedRaw: committed });
}, 1);
add('a managedRules key present live but absent from committed is REFUSED, not silently skipped', () => {
  const live = clone(FIXTURE_COMMITTED_RAW);
  live.managedRules.surprise_category = { active: true, action: 'log' };
  return runMain([], live);
}, 1);
add('a managedRules field change applies and re-confirms clean', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.managedRules.ai_bots.active = false;
  const live = clone(FIXTURE_COMMITTED_RAW);
  return runMain([], live, { committedRaw: committed });
}, 0);
add('rules.insert reconciles the Vercel-assigned id -- no false "still differs"', () => {
  const committed = clone(FIXTURE_COMMITTED_RAW);
  committed.rules.push({
    id: 'rule_placeholder',
    name: 'New rule',
    active: true,
    description: 'd2',
    conditionGroup: [{ conditions: [{ type: 'path', op: 'eq', value: '/api/y' }] }],
    action: { mitigate: { action: 'log', redirect: null, rateLimit: null, actionDuration: null } },
  });
  return runMain([], clone(FIXTURE_COMMITTED_RAW), { committedRaw: committed });
}, 0);

async function selfTest() {
  let pass = 0;
  for (const c of cases) {
    let actual;
    try { actual = await c.run(); } catch (error) { actual = 'THREW: ' + error.message; }
    const ok = actual === c.expected;
    if (ok) pass++;
    else console.error(`  FAIL  ${c.name} -- expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`apply-firewall self-test: ${pass}/${cases.length} passed`);
  return pass === cases.length;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs) -- not this repo's
// convention lightly skipped: a raw import.meta/argv[1] compare mispredicts
// through a junction or symlink and this script -- which mutates PROD -- would
// exit 0 having done nothing, indistinguishable from a real apply. Placed
// LAST: main() -> selfTest() reaches every `const` fixture above it (same TDZ
// reasoning as check-firewall-drift.mjs), and this is a top-level `await`.
if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
