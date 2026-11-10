/**
 * Welcome W1 (contract cell J12.8): links a teacher / DJ / dancer typed on their own public page are
 * user-generated content, so the anchor that opens them in a new tab must carry the shared
 * PUBLIC_LINK_REL (`noopener nofollow ugc`, from organiserLinkLabels) -- never `noreferrer`,
 * never a second hand-written rel string.
 *
 * Source-text guard, table-driven: every `<a ...>` opening tag in the listed files that opens a new tab
 * (`target="_blank"` or a `{ target: '_blank', ... }` spread) must use PUBLIC_LINK_REL, unless it is one
 * of the listed app-generated exceptions (matched by file + a unique snippet of the tag text). A new
 * unlisted `noopener noreferrer` anchor in any of these files turns this red.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_LINK_REL } from '@/lib/organiserLinkLabels';

type Row = {
  file: string;
  /** How many new-tab anchors carry the user-link rel. */
  userLinks: number;
  /** App-generated new-tab anchors that keep `noopener noreferrer`, by a snippet unique to the tag. */
  exceptions: { snippet: string; why: string }[];
};

const ROWS: Row[] = [
  { file: 'src/modules/person-page/PersonPage.tsx', userLinks: 1, exceptions: [] },
  { file: 'src/modules/person-page/worlds/dancer/DancerWorld.tsx', userLinks: 1, exceptions: [] },
  { file: 'src/modules/person-page/worlds/dj/DjWorld.tsx', userLinks: 1, exceptions: [] },
  { file: 'src/modules/person-page/worlds/teacher/TeacherWorld.tsx', userLinks: 1, exceptions: [] },
  { file: 'src/pages/TeacherProfile.tsx', userLinks: 5, exceptions: [] },
  { file: 'src/pages/DancerProfile.tsx', userLinks: 1, exceptions: [] },
  {
    file: 'src/components/dj/DjTiles.tsx',
    userLinks: 8,
    exceptions: [{ snippet: 'href={`https://wa.me/${phoneDigits(p.phone)}`}', why: 'app-built wa.me URL (digits only), not a typed destination' }],
  },
  { file: 'src/components/dj/DjRolePage.tsx', userLinks: 3, exceptions: [] },
  { file: 'src/components/profile/DancerProfileGrid.tsx', userLinks: 5, exceptions: [] },
];

/** Every `<a` opening tag, scanned to the `>` at brace depth 0 so `=>` inside `{...}` cannot end it. */
function openingAnchors(src: string): string[] {
  const out: string[] = [];
  const re = /<a(?=[\s>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + 2;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

const NEW_TAB = /target(?:=|:\s*)["']_blank["']/;
const USES_CONST = /rel(?:=\{|:\s*)PUBLIC_LINK_REL\b/;

describe('public user links carry PUBLIC_LINK_REL (J12.8)', () => {
  it('the shared constant is the ugc rel', () => {
    expect(PUBLIC_LINK_REL).toBe('noopener nofollow ugc');
  });

  it.each(ROWS)('$file', ({ file, userLinks, exceptions }) => {
    const src = readFileSync(resolve(process.cwd(), file), 'utf8');
    const anchors = openingAnchors(src).filter((a) => NEW_TAB.test(a));
    const isException = (a: string) => exceptions.some((e) => a.includes(e.snippet));

    for (const e of exceptions) {
      const hits = anchors.filter((a) => a.includes(e.snippet));
      expect(hits, `exception "${e.snippet}" must match exactly one new-tab anchor`).toHaveLength(1);
      expect(hits[0]).toContain('noopener');
    }

    const userAnchors = anchors.filter((a) => !isException(a));
    for (const a of userAnchors) {
      expect(a, `user-link anchor must use PUBLIC_LINK_REL:\n${a}`).toMatch(USES_CONST);
      expect(a).not.toMatch(/noreferrer/);
    }
    expect(userAnchors).toHaveLength(userLinks);
    expect(src).toMatch(/import \{ PUBLIC_LINK_REL \} from '@\/lib\/organiserLinkLabels';/);
    // No second hand-written copy of the rel string.
    expect(src).not.toMatch(/nofollow ugc/);
  });
});
