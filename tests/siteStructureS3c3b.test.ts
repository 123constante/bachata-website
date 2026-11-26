import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(f, 'utf8');

describe('S3c-3b: Raffles leaves header and bottom nav; For organisers in footer and sitemap', () => {
  for (const f of ['src/components/GlobalHeader.tsx', 'src/components/BottomNav.tsx']) {
    it(`${f} has no /raffles entry`, () => {
      expect(read(f)).not.toContain("'/raffles'");
    });
  }

  it('footer links For organisers and no Raffles', () => {
    const src = read('src/lib/contactLinks.tsx');
    expect(src).toContain("to: '/for-organisers'");
    expect(src).not.toContain("label: 'Raffles'");
  });

  it('sitemap lists /for-organisers', () => {
    expect(read('app/routes/sitemap.tsx')).toContain('"/for-organisers"');
  });
});
