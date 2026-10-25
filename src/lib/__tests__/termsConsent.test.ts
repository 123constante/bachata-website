import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TERMS_VERSION } from '../termsConsent';

describe('terms version is one fact', () => {
  const legal = resolve(__dirname, '../legalVersions.ts');
  const present = existsSync(legal);
  if (!present) console.info('SKIP terms-version parity: src/lib/legalVersions.ts (Website PR #762) is not in this branch yet');
  it.skipIf(!present)('equals TERMS_VERSION in legalVersions.ts (PR #762)', () => {
    const m = /TERMS_VERSION\s*=\s*'([^']+)'/.exec(readFileSync(legal, 'utf8'));
    expect(TERMS_VERSION).toBe(m?.[1]);
  });
  it('matches the format accept_terms_v1 admits', () => {
    expect(TERMS_VERSION).toMatch(/^[0-9A-Za-z._-]{1,32}$/);
  });
});
