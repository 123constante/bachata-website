import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  'src/pages/Classes.tsx',
  'src/pages/Parties.tsx',
  'src/pages/NotFound.tsx',
  'src/pages/seo/BachataWeekday.tsx',
];

describe('S3b-2: in-page links skip the redirects', () => {
  for (const f of FILES) {
    const src = readFileSync(f, 'utf8');
    it(`${f} links to the Learn page, not a redirect`, () => {
      expect(src).not.toContain('"/london-bachata-guide"');
      expect(src).not.toContain('"/faq"');
      expect(src).toContain('/learn-bachata-london');
    });
  }
});
