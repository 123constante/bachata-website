// walk-hosts.mjs -- slice 10 Part D: the walk host picker (contract 11 item 7,
// drill A35). PURE: no fs, no network, no clock, no env.
//
// Decides which walk host may take the next 390x844 walk. One lock per host
// (a host never receives two walks at once), FIFO waiting (the oldest request
// is served first, ties broken by id), and per-host rules:
//   dell    -- only when no CI job is running and free RAM is above 3 GB
//   pc      -- only when the owner has not flagged the machine busy
//   laptop2 -- only after a passed day test run
// Every host also needs locked === false and isSecretsRunner === false: a host
// that is also the secrets-holding runner is never chosen (Part E isolation).
//
// Fail closed: a flag that is not a boolean, a RAM reading that is not a finite
// number, an unknown host name, a duplicate host or request, or any malformed
// input yields NO assignment with a reason -- never a throw from pickWalkHost and
// never an assignment on doubt. Per-host doubt (a bad reading on one known host)
// only rules that host out; structural doubt (unknown or duplicate host names,
// malformed entries, a queue that is not a list) blocks the whole pick, because
// the host table and the caller no longer agree on what exists.
//
// Not here (still left): `.github/automation/walk-hosts.json` (a guard path,
// owner-merged) and the lock wiring that acquires `hostLockKey(...).lock`.

const SHA40 = /^[0-9a-f]{40}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Dell's RAM floor in GB; the reading must be strictly above it. */
export const DELL_MIN_FREE_RAM_GB = 3;

const needFalse = (field) => (h) =>
  typeof h[field] !== 'boolean' ? `${field} is not a boolean` : h[field] ? `${field} is true` : null;
const needTrue = (field) => (h) =>
  typeof h[field] !== 'boolean' ? `${field} is not a boolean` : h[field] ? null : `${field} is false`;
const needRam = (h) => {
  const v = h.freeRamGb;
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'freeRamGb is not a finite number';
  return v > DELL_MIN_FREE_RAM_GB ? null : `freeRamGb ${v} is not above ${DELL_MIN_FREE_RAM_GB}`;
};

const COMMON = Object.freeze([needFalse('locked'), needFalse('isSecretsRunner')]);

/**
 * The host table. Order is the preference order when several hosts are free.
 * `requires` is the human-readable rule; `checks` are what pickWalkHost applies.
 */
export const WALK_HOST_RULES = Object.freeze({
  dell: Object.freeze({
    requires: Object.freeze({ locked: false, isSecretsRunner: false, ciRunning: false, freeRamGbAbove: DELL_MIN_FREE_RAM_GB }),
    checks: Object.freeze([...COMMON, needFalse('ciRunning'), needRam]),
  }),
  pc: Object.freeze({
    requires: Object.freeze({ locked: false, isSecretsRunner: false, ownerBusy: false }),
    checks: Object.freeze([...COMMON, needFalse('ownerBusy')]),
  }),
  laptop2: Object.freeze({
    requires: Object.freeze({ locked: false, isSecretsRunner: false, dayTestRunPassed: true }),
    checks: Object.freeze([...COMMON, needTrue('dayTestRunPassed')]),
  }),
});

const HOST_ORDER = Object.freeze(Object.keys(WALK_HOST_RULES));
const known = (name) => Object.prototype.hasOwnProperty.call(WALK_HOST_RULES, name);

/** Why a known host may not take a walk now, or null when it may. */
function hostBlock(host) {
  const reasons = [];
  for (const check of WALK_HOST_RULES[host.name].checks) {
    const r = check(host);
    if (r) reasons.push(r);
  }
  return reasons.length ? reasons.join(', ') : null;
}

function requestTime(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim() !== '') return Date.parse(v);
  return NaN;
}

/** Structural errors in the input; [] when the pick may proceed. */
function structuralErrors(hosts, queue) {
  const errors = [];
  if (!Array.isArray(hosts)) errors.push('hosts is not an array');
  else {
    const seen = new Set();
    hosts.forEach((h, i) => {
      if (!isObj(h)) return errors.push(`hosts[${i}] is not an object`);
      if (typeof h.name !== 'string' || h.name === '') return errors.push(`hosts[${i}] has no name`);
      if (!known(h.name)) errors.push(`unknown host ${JSON.stringify(h.name)}`);
      if (seen.has(h.name)) errors.push(`duplicate host ${h.name}`);
      seen.add(h.name);
    });
  }
  if (!Array.isArray(queue)) errors.push('queue is not an array');
  else {
    const seen = new Set();
    queue.forEach((q, i) => {
      if (!isObj(q)) return errors.push(`queue[${i}] is not an object`);
      if (typeof q.id !== 'string' || q.id.trim() === '') return errors.push(`queue[${i}] has no id`);
      if (seen.has(q.id)) errors.push(`duplicate request ${q.id}`);
      seen.add(q.id);
      if (Number.isNaN(requestTime(q.requestedAt))) errors.push(`request ${q.id} has no valid requestedAt`);
    });
  }
  return errors;
}

/** Requests that have a usable id, for reporting reasons on malformed input. */
function reportableIds(queue) {
  if (!Array.isArray(queue)) return [];
  const ids = [];
  for (const q of queue) {
    if (isObj(q) && typeof q.id === 'string' && q.id.trim() !== '' && !ids.includes(q.id)) ids.push(q.id);
  }
  return ids;
}

/**
 * Picks at most one walk: the oldest request gets the first free host in table
 * order. Returns { assign: { requestId, host } | null, waiting: [{ requestId, reason }] }.
 * Never throws.
 */
export function pickWalkHost(hosts, queue) {
  const errors = structuralErrors(hosts, queue);
  if (errors.length) {
    const reason = `no assignment, malformed input: ${errors.join('; ')}`;
    const ids = reportableIds(queue);
    return { assign: null, waiting: ids.length ? ids.map((requestId) => ({ requestId, reason })) : [{ requestId: null, reason }] };
  }
  if (queue.length === 0) return { assign: null, waiting: [] };

  const ordered = queue
    .map((q) => ({ id: q.id, t: requestTime(q.requestedAt) }))
    .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const byName = new Map(hosts.map((h) => [h.name, h]));
  const blocks = [];
  let freeHost = null;
  for (const name of HOST_ORDER) {
    const h = byName.get(name);
    if (!h) continue;
    const block = hostBlock(h);
    if (block === null) {
      freeHost = name;
      break;
    }
    blocks.push(`${name}: ${block}`);
  }

  const [first, ...rest] = ordered;
  if (freeHost === null) {
    const why = hosts.length === 0 ? 'no walk hosts reported' : `no free walk host (${blocks.join('; ')})`;
    return {
      assign: null,
      waiting: ordered.map((r, i) => ({
        requestId: r.id,
        reason: i === 0 ? why : `${why}; queued behind ${ordered[i - 1].id}`,
      })),
    };
  }
  return {
    assign: { requestId: first.id, host: freeHost },
    waiting: rest.map((r, i) => ({
      requestId: r.id,
      reason: `one walk per pick; ${freeHost} taken by ${first.id}; queued behind ${i === 0 ? first.id : rest[i - 1].id}`,
    })),
  };
}

/**
 * Stable keys for one walk: `lock` is the per-host lock (`walk:<host>`), `build`
 * the build-once cache key for the head (`build:<headSha>`). Throws on an empty
 * or unknown host, or a headSha that is not 40 lowercase hex characters.
 */
export function hostLockKey(host, headSha) {
  if (typeof host !== 'string' || host.trim() === '') throw new Error('hostLockKey: host is empty');
  if (!known(host)) throw new Error(`hostLockKey: unknown host ${JSON.stringify(host)}`);
  if (typeof headSha !== 'string' || !SHA40.test(headSha)) throw new Error('hostLockKey: headSha is not 40 hex characters');
  return { lock: `walk:${host}`, build: `build:${headSha}` };
}
