/**
 * component_sha (drill-record rule 1.1(6)): sha256 hex of the EXACT text of
 *   git ls-tree -r <ref> -- <path set>
 * for a component's path set from `.github/automation/components.json` (a GUARD path).
 *
 * Deterministic: the path specs are sorted and de-duplicated, and there is ONE fixed invocation
 * (lsTreeArgs). Paths are literal files or directory prefixes: git ls-tree does not expand globs
 * (verified 2026-11-04: `scripts/lib/autopilot*` lists nothing, `:(glob)` magic is refused), so
 * components.json may not carry a glob character. A path not yet in the tree contributes no line;
 * when it lands, the sha changes, which is the point (a changed component is re-drilled).
 * An EMPTY path set is refused: `git ls-tree -r main --` with no path lists the whole tree.
 * Node built-ins only; git runs through execFileSync, never a shell.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

function specs(pathSet) {
  if (!Array.isArray(pathSet) || pathSet.length === 0) throw new Error('component path set is empty (would hash the whole tree)');
  for (const p of pathSet) if (typeof p !== 'string' || p === '' || p.startsWith('-')) throw new Error(`bad path spec ${JSON.stringify(p)}`);
  return [...new Set(pathSet)].sort();
}

/** The one fixed git invocation for a path set. */
export function lsTreeArgs(pathSet, ref = 'main') {
  if (typeof ref !== 'string' || !/^[\w./-]+$/.test(ref) || ref.startsWith('-')) throw new Error(`bad ref ${JSON.stringify(ref)}`);
  return ['ls-tree', '-r', ref, '--', ...specs(pathSet)];
}

/** sha256 hex of the exact ls-tree text for this path set. */
export function componentSha(pathSet, lsTreeText) {
  specs(pathSet);
  if (typeof lsTreeText !== 'string') throw new Error('ls-tree text is not a string');
  return createHash('sha256').update(lsTreeText).digest('hex');
}

const defaultGit = (args, cwd) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', cwd, maxBuffer: 64 * 1024 * 1024 });

/** Shells out (no shell) and hashes. opts: { ref = 'main', cwd, git(args, cwd) }. */
export function componentShaFromGit(pathSet, { ref = 'main', cwd, git = defaultGit } = {}) {
  return componentSha(pathSet, git(lsTreeArgs(pathSet, ref), cwd));
}
