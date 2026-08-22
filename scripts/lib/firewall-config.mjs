// scripts/lib/firewall-config.mjs
//
// Shared pure functions plus a thin Vercel Firewall Config API client, used
// by both scripts/apply-firewall.mjs and scripts/check-firewall-drift.mjs so
// the two never drift into disagreeing about what a "field" is (the same
// reason scripts/lib/dotenv.mjs was extracted for #67/#68).
//
// THE CANONICAL SHAPE strips every field Vercel assigns rather than a human
// authors: the top-level id/version/updatedAt/ownerId/projectKey/changes (per
// the P3 handoff), and -- less obviously, found while building this file --
// the per-managed-rule `updatedAt` and the per-custom-rule
// `valid`/`validationErrors`. Those two are not in the handoff's explicit
// drop list, and they are load-bearing for the same reason the listed ones
// are: apply-firewall.mjs restoring a field to its committed value still
// gets a FRESH updatedAt from Vercel (a real write, not a no-op), so a diff
// that compared it would stay red forever after every successful restore --
// exactly the case the arc's own "revert and confirm green" verification
// requires to pass.

const API = 'https://api.vercel.com';

export class VercelApiError extends Error {}

/** The config itself is internally inconsistent (e.g. two rules sharing an
 *  id) -- distinct from VercelApiError, which is a transport/HTTP problem. */
export class FirewallConfigError extends Error {}

/** One managed-rule / CRS-category entry, author-controlled fields only. */
function canonicalRuleValue(entry) {
  return { active: entry?.active === true, action: entry?.action };
}

/**
 * One custom rule, author-controlled fields only. `id` IS kept here, unlike
 * the top-level config `id` -- a custom rule's id is how rules.update /
 * rules.remove address it (a live reference), not a snapshot timestamp.
 */
function canonicalCustomRule(rule) {
  return {
    id: rule?.id,
    name: rule?.name,
    active: rule?.active === true,
    description: rule?.description ?? '',
    conditionGroup: rule?.conditionGroup ?? [],
    action: rule?.action ?? null,
  };
}

/**
 * The full live (or committed) config, reduced to exactly the fields this
 * repo authors. Both scripts run every config -- live or on-disk -- through
 * this before comparing, so a server-assigned field can never present as
 * drift.
 */
function canonicalRuleMap(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) out[key] = canonicalRuleValue(value);
  return out;
}

export function canonicalizeConfig(raw) {
  return {
    managedRules: canonicalRuleMap(raw?.managedRules),
    crs: canonicalRuleMap(raw?.crs),
    rules: (raw?.rules ?? []).map(canonicalCustomRule),
    ips: raw?.ips ?? [],
    firewallEnabled: raw?.firewallEnabled === true,
  };
}

/**
 * Is this a config a caller can safely treat as measured? `typeof null ===
 * 'object'` in JS, so a naive `typeof raw.managedRules !== 'object'` check
 * passes right through a literal `managedRules: null` and the caller's next
 * `Object.keys(null)` throws -- an uncaught exception escaping as a stack
 * trace and a non-2 exit, instead of the documented "cannot measure" exit 2.
 * Both apply-firewall.mjs and check-firewall-drift.mjs call this on every
 * fetch, live and post-apply alike, so the predicate can only drift once.
 */
export function isPlausibleLiveConfig(raw) {
  return !!raw && typeof raw === 'object' &&
    raw.managedRules !== null && typeof raw.managedRules === 'object' &&
    Object.keys(raw.managedRules).length > 0;
}

/** Every key present in either map, key-value diffs on active/action. */
function diffRuleMap(section, committed, live, findings) {
  const keys = new Set([...Object.keys(committed ?? {}), ...Object.keys(live ?? {})]);
  for (const key of [...keys].sort()) {
    const c = committed?.[key];
    const l = live?.[key];
    if (c && !l) { findings.push({ path: `${section}.${key}`, committed: c, live: null }); continue; }
    if (!c && l) { findings.push({ path: `${section}.${key}`, committed: null, live: l }); continue; }
    for (const field of ['active', 'action']) {
      if (c[field] !== l[field]) {
        findings.push({ path: `${section}.${key}.${field}`, committed: c[field], live: l[field] });
      }
    }
  }
}

/**
 * JSON.stringify with object keys sorted at every level -- array ORDER is
 * kept (semantically meaningful: a conditionGroup's condition order can
 * change evaluation), object KEY order is not. Plain JSON.stringify found a
 * false positive on this file's first live dry-run: the committed file was
 * hand-authored with `{type,op,value}` inside one condition and Vercel's API
 * returns `{type,value,op}` -- byte-different, semantically identical, and a
 * raw stringify compare called it drift.
 */
function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]))
      .join(',') + '}';
  }
  return JSON.stringify(value);
}

/** Every rule's id, keyed -- and REFUSED if two rules in the same list share
 *  one. A duplicate id would silently shadow the earlier rule in the Map
 *  below with no error, no warning, and no drift signal that the file (or
 *  the live config) is internally inconsistent. */
function byId(list, label) {
  const map = new Map();
  for (const r of list ?? []) {
    if (map.has(r.id)) {
      throw new FirewallConfigError(
        `${label} rules[] contains two rules with the same id "${r.id}" -- the later one would ` +
          'silently shadow the earlier one in every id-keyed diff.',
      );
    }
    map.set(r.id, r);
  }
  return map;
}

/** Custom rules matched by id, never by array index -- reordering a rule on
 *  Vercel's side must not read as a remove-plus-insert pair. */
function diffRules(committed, live, findings) {
  const cById = byId(committed, 'committed');
  const lById = byId(live, 'live');
  const ids = new Set([...cById.keys(), ...lById.keys()]);
  for (const id of [...ids].sort()) {
    const c = cById.get(id);
    const l = lById.get(id);
    if (c && !l) { findings.push({ path: `rules[${id}]`, committed: c, live: null }); continue; }
    if (!c && l) { findings.push({ path: `rules[${id}]`, committed: null, live: l }); continue; }
    for (const field of ['name', 'active', 'description']) {
      if (c[field] !== l[field]) {
        findings.push({ path: `rules[${id}].${field}`, committed: c[field], live: l[field] });
      }
    }
    if (stableStringify(c.conditionGroup) !== stableStringify(l.conditionGroup)) {
      findings.push({ path: `rules[${id}].conditionGroup`, committed: c.conditionGroup, live: l.conditionGroup });
    }
    if (stableStringify(c.action) !== stableStringify(l.action)) {
      findings.push({ path: `rules[${id}].action`, committed: c.action, live: l.action });
    }
  }
}

/**
 * Every field that differs between two ALREADY-CANONICALIZED configs.
 * Pure -- no network, no fs -- so the drift-check canary drives it directly.
 * @returns {{path:string, committed:*, live:*}[]}
 */
export function diffConfig(committed, live) {
  const findings = [];
  diffRuleMap('managedRules', committed.managedRules, live.managedRules, findings);
  diffRuleMap('crs', committed.crs, live.crs, findings);
  diffRules(committed.rules, live.rules, findings);
  if (committed.firewallEnabled !== live.firewallEnabled) {
    findings.push({ path: 'firewallEnabled', committed: committed.firewallEnabled, live: live.firewallEnabled });
  }
  if (stableStringify(committed.ips ?? []) !== stableStringify(live.ips ?? [])) {
    findings.push({ path: 'ips', committed: committed.ips, live: live.ips });
  }
  return findings;
}

export function formatFinding(f) {
  return `${f.path}: committed=${JSON.stringify(f.committed)} live=${JSON.stringify(f.live)}`;
}

/** A rule's content, id excluded -- Vercel assigns rules.insert's id itself
 *  (confirmed live: an empty `{}` response body, the real id only visible on
 *  the next GET), so a freshly-inserted rule can never be found again by the
 *  placeholder id the committed file used to author it. */
export function ruleContentKey(rule) {
  return stableStringify({
    name: rule.name,
    description: rule.description,
    conditionGroup: rule.conditionGroup,
    action: rule.action,
  });
}

/**
 * After apply-firewall.mjs runs one or more rules.insert PATCHes, the
 * post-apply confirmation re-diffs committed against a fresh live read --
 * and every inserted rule shows up TWICE: the committed placeholder id
 * ("missing from live") and Vercel's real assigned id ("missing from
 * committed"). Neither is wrong, and neither is drift; it is exactly the
 * apply that just ran, reported honestly by an id-keyed diff that was never
 * told the two ids mean the same rule.
 *
 * This matches each placeholder to the live rule with IDENTICAL content
 * (ruleContentKey) that isn't already claimed by a DIFFERENT committed rule,
 * drops the two findings that pairing produced, and leaves a note pointing
 * the operator at the real id -- because leaving the false failure stand
 * would make a second run rules.insert the same rule again (a duplicate)
 * while rules.remove-ing the one it just created (thrashing on every retry).
 */
export function reconcileInsertedRules(committedRules, liveRules, insertedPlaceholderIds, findings) {
  const notes = [];
  let remaining = findings;
  const claimedLiveIds = new Set(committedRules.map((r) => r.id));
  for (const placeholderId of insertedPlaceholderIds) {
    const committedRule = committedRules.find((r) => r.id === placeholderId);
    if (!committedRule) continue;
    const wantKey = ruleContentKey(committedRule);
    const match = liveRules.find(
      (r) => r.id !== placeholderId && !claimedLiveIds.has(r.id) && ruleContentKey(r) === wantKey,
    );
    if (!match) continue;
    const before = remaining.length;
    remaining = remaining.filter(
      (f) => f.path !== `rules[${placeholderId}]` && f.path !== `rules[${match.id}]`,
    );
    if (remaining.length < before) {
      notes.push(
        `rules.insert for "${committedRule.name}" (committed as ${placeholderId}) landed on Vercel's ` +
          `side as ${match.id} -- update vercel-firewall.json's id to "${match.id}" and re-commit so ` +
          'future drift checks match it directly.',
      );
    }
  }
  return { remaining, notes };
}

/** VERCEL_TOKEN / VERCEL_PROJECT / VERCEL_TEAM_ID -- the exact env names
 *  scripts/fetch-vercel-build-log.mjs already established; reused rather
 *  than a second naming scheme. */
export function resolveVercelEnv(env = process.env) {
  return {
    token: (env.VERCEL_TOKEN ?? '').trim(),
    project: (env.VERCEL_PROJECT ?? 'bachata-website').trim(),
    teamId: (env.VERCEL_TEAM_ID ?? '').trim(),
  };
}

async function vercelJson(fetchImpl, token, pathname, init = {}) {
  let res;
  try {
    res = await fetchImpl(`${API}${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch (error) {
    throw new VercelApiError(`Vercel API ${init.method ?? 'GET'} ${pathname} could not be reached: ${error.message}`);
  }
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const message = body && typeof body === 'object'
      ? (body.error?.message ?? JSON.stringify(body).slice(0, 300))
      : String(body ?? '').slice(0, 300);
    throw new VercelApiError(`Vercel API ${init.method ?? 'GET'} ${pathname} -> HTTP ${res.status}: ${message}`);
  }
  return body;
}

/** Project name -> id. Same lookup fetch-vercel-build-log.mjs does; a second
 *  copy of "how do we resolve a project" would drift like a second number. */
export async function resolveProjectId(fetchImpl, token, project, teamId) {
  const q = teamId ? `?teamId=${teamId}` : '';
  const body = await vercelJson(fetchImpl, token, `/v9/projects/${project}${q}`);
  if (!body?.id) {
    throw new VercelApiError(`could not resolve project "${project}" to an id -- check the name and token scope`);
  }
  return body.id;
}

const activePath = (projectId, teamId) =>
  `/v1/security/firewall/config/active?projectId=${projectId}${teamId ? `&teamId=${teamId}` : ''}`;
const configPath = (projectId, teamId) =>
  `/v1/security/firewall/config?projectId=${projectId}${teamId ? `&teamId=${teamId}` : ''}`;

export async function fetchActiveConfig(fetchImpl, token, projectId, teamId) {
  return vercelJson(fetchImpl, token, activePath(projectId, teamId));
}

/**
 * One PATCH action against the live firewall config: {action, id, value}
 * (managedRules.update / crs.update / rules.update / rules.remove) or
 * {action, value} (rules.insert -- Vercel assigns the id). VERIFIED LIVE
 * 2026-08-22 for managedRules.update (P0's own shape), rules.insert,
 * rules.update and rules.remove -- see apply-firewall.mjs's header for the
 * exact transcript and for crs.update's UNVERIFIED status.
 */
export async function patchFirewallConfig(fetchImpl, token, projectId, teamId, payload) {
  return vercelJson(fetchImpl, token, configPath(projectId, teamId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
