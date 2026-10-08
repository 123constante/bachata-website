import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { survey } from './lib/shapes';

// Runs the read-only shape survey ONCE per run (not once per worker) and hands
// it to the specs as a file. Also clears the previous run's findings log so
// findings.ndjson describes exactly this run.
export const SURVEY_FILE = join('test-results', 'live-qa', 'survey.json');

export default async function globalSetup() {
  mkdirSync(join('test-results', 'live-qa'), { recursive: true });
  rmSync(join('test-results', 'live-qa', 'findings.ndjson'), { force: true });
  const result = await survey();
  writeFileSync(SURVEY_FILE, JSON.stringify(result, null, 2));
  if ('skip' in result) {
    console.log(`[live-qa] shape survey skipped: ${result.skip}`);
    return;
  }
  console.log(`[live-qa] shapes today (${result.shapes.length}):`);
  for (const s of result.shapes) console.log(`  ${s.shape_key.padEnd(58)} /event/${s.slug}`);
  console.log(`[live-qa] organisers with no events: ${result.empty_organisers.length}`);
}
