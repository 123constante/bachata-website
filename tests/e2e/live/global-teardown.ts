import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BASELINE_FILE, FINDINGS_FILE } from './lib/visit';

// LIVE_QA_UPDATE_BASELINE=1 only: fold every finding of this run into
// baseline.json (union; nothing is ever dropped automatically). Review the
// diff like code -- a baseline entry is a known defect the suite stops
// failing on, and each one should be in a PR body or an issue.
export default async function globalTeardown() {
  if (process.env.LIVE_QA_UPDATE_BASELINE !== '1' || !existsSync(FINDINGS_FILE)) return;
  const file = BASELINE_FILE;
  const base = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string[]>>;
  for (const line of readFileSync(FINDINGS_FILE, 'utf8').split('\n').filter(Boolean)) {
    const f = JSON.parse(line) as { tpl: string; rule: string; sig: string };
    const list = ((base[f.tpl] ??= {})[f.rule] ??= []);
    if (!list.includes(f.sig)) list.push(f.sig);
  }
  const sorted = Object.fromEntries(Object.keys(base).sort().map((tpl) => [tpl,
    Object.fromEntries(Object.keys(base[tpl]).sort().map((r) => [r, [...base[tpl][r]].sort()]))]));
  writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`[live-qa] baseline.json updated from ${FINDINGS_FILE}`);
}
