/**
 * vercel.json git.deploymentEnabled -- Vercel's matching rule, Node built-ins only (the autopilot
 * workflow runs without `npm install`, so minimatch is not available there).
 *
 *   - keys are globs: `*` and `?` do not cross `/`, `**` does;
 *   - a branch no key matches gets Vercel's default (deploys);
 *   - a branch several keys match deploys if AT LEAST ONE of them is true
 *     (not "most specific wins").
 *
 * tests/vercelDeploymentEnabled.test.ts holds the minimatch reference (deploys()) and asserts this
 * module agrees with it on the real vercel.json and on the documented edge cases.
 */

/** One branch name against one glob key. */
export function branchGlobMatch(branch, glob) {
  let re = '';
  const g = String(glob);
  for (let i = 0; i < g.length; i += 1) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { re += '.*'; i += 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(String(branch ?? ''));
}

/**
 * @returns {boolean|null} true/false per Vercel's rule, null when no key matches (Vercel default:
 * deploys) or when there is no table at all.
 */
export function deploymentEnabledByTable(branch, table) {
  if (!table || typeof table !== 'object') return null;
  const hits = Object.entries(table).filter(([glob]) => branchGlobMatch(branch, glob));
  if (hits.length === 0) return null;
  return hits.some(([, on]) => on === true);
}
