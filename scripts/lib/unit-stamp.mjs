// Pure decision for "did `npm run pre-ship` already pass the unit suite on THIS exact tree?"
// pre-ship writes the stamp (keyed by the TREE sha, so an amend/rebase with an identical
// tree still counts); .githooks/pre-push reads it and may skip its offline unit gate.
// Fail closed: anything unreadable, stale, missing or for another tree means RUN the gate.

export const STAMP_MAX_AGE_MS = 60 * 60 * 1000;

export function formatStamp(tree, nowMs) {
  return JSON.stringify({ tree: String(tree), at: nowMs });
}

/** Stamp only a clean tree that did not move while the suite ran. Both args: {tree, clean}. */
export function canWriteStamp(before, after) {
  return !!(before && after && before.clean === true && after.clean === true && before.tree === after.tree);
}

/** @returns {{skip: boolean, minutes?: number}} */
export function decideUnitStamp(stampText, tree, nowMs) {
  const run = { skip: false };
  if (typeof stampText !== "string" || !/^[0-9a-f]{40,64}$/.test(String(tree))) return run;
  let stamp;
  try {
    stamp = JSON.parse(stampText);
  } catch {
    return run;
  }
  if (!stamp || typeof stamp.tree !== "string" || typeof stamp.at !== "number") return run;
  if (!Number.isFinite(stamp.at) || !Number.isFinite(nowMs)) return run;
  if (stamp.tree !== tree) return run;
  const age = nowMs - stamp.at;
  if (age < 0 || age >= STAMP_MAX_AGE_MS) return run;
  return { skip: true, minutes: Math.floor(age / 60000) };
}
