/**
 * S5 source scans (plan 4.5 + 4.11): the one-importer rules, the review-era
 * strip, the deprecated link keys and the event-truth editor reached as a row.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const MODULE = resolve(__dirname, '../..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
const source = (dir: string) => files(resolve(MODULE, dir)).filter((p) => !p.includes('__tests__'));
const rel = (p: string) => relative(MODULE, p).split('\\').join('/');
const read = (p: string) => readFileSync(p, 'utf8');

describe('S5 scans', () => {
  it('WARN_END is imported by exactly ONE file, the End confirm (R3-8)', () => {
    const users = source('.').filter((p) => /import[^;]*\bWARN_END\b[^;]*from/.test(read(p))).map(rel);
    expect(users).toEqual(['flows/event/EndStep.tsx']);
  });

  it('no review-era import or "Send for review" copy in events/ or flows/event/', () => {
    const hits = [...source('events'), ...source('flows/event')]
      .filter((p) => /import[^;]*(ReviewCard|reviewModel|useSendForReview)[^;]*;/.test(read(p)) || /Send for review/.test(read(p)))
      .map(rel);
    expect(hits).toEqual([]);
  });

  it('ORG_PATHS.date and ORG_PATHS.newEvent have no caller under events/', () => {
    const hits = source('events').filter((p) => /ORG_PATHS\.(date|newEvent)\b/.test(read(p))).map(rel);
    expect(hits).toEqual([]);
  });

  it('the old editor page and the review files are gone', () => {
    const names = source('events').map(rel);
    for (const gone of ['events/EventEditorPage.tsx', 'events/ReviewCard.tsx', 'events/reviewModel.ts']) expect(names).not.toContain(gone);
  });

  it('Details reaches the EXISTING event-truth editor (EditorRows + EditorSheet), never a copy', () => {
    const details = read(resolve(MODULE, 'events/Details.tsx'));
    expect(details).toMatch(/import \{[^}]*\bScheduleCard\b[^}]*\} from '\.\/EditorRows'/);
    expect(details).toMatch(/import \{[^}]*\bEditorSheet\b[^}]*\} from '\.\/EditorSheet'/);
    const copies = source('.').filter((p) => /export function (ScheduleCard|EditorSheet)\b/.test(read(p))).map(rel).sort();
    expect(copies).toEqual(['events/EditorRows.tsx', 'events/EditorSheet.tsx']);
  });
});
