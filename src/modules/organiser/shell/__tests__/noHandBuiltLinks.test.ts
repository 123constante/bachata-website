import { describe, expect, it } from 'vitest';
import { moduleSources, readModuleFile } from './sourceScan';

// 4.3 #2 / 4.11: no link in the organiser module is built by hand. Every
// '/account/o...' literal lives in shell/paths.ts; everything else uses ORG_PATHS.
const LITERAL = /['"`]\/account\/o(?![A-Za-z0-9_-])/;

// Files on main that still carry a literal, each owned by a later slice. The list
// only shrinks: an entry whose file no longer has a hit fails the second test.
const KNOWN: Record<string, string> = {};

export function handBuiltLinkHits(files: { rel: string; text: string }[]): string[] {
  return files.filter((f) => f.rel !== 'shell/paths.ts' && LITERAL.test(f.text)).map((f) => f.rel);
}

describe('no hand-built /account/o links', () => {
  const files = moduleSources().map((rel) => ({ rel, text: readModuleFile(rel) }));

  it('only shell/paths.ts spells the base', () => {
    expect(handBuiltLinkHits(files).filter((rel) => !(rel in KNOWN))).toEqual([]);
  });

  it('the known list is not stale', () => {
    const hits = handBuiltLinkHits(files);
    expect(Object.keys(KNOWN).filter((rel) => !hits.includes(rel))).toEqual([]);
  });

  it('the scanner catches every quote style and ignores look-alikes', () => {
    const plant = (text: string) => handBuiltLinkHits([{ rel: 'x.tsx', text }]);
    expect(plant("to='/account/o'")).toEqual(['x.tsx']);
    expect(plant('to="/account/o/team"')).toEqual(['x.tsx']);
    expect(plant('to={`/account/o/events/${id}`}')).toEqual(['x.tsx']);
    expect(plant("to='/account/organisers'")).toEqual([]);
    expect(handBuiltLinkHits([{ rel: 'shell/paths.ts', text: "'/account/o'" }])).toEqual([]);
  });
});
