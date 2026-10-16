// L27: termsConsent has no version of its own. Bumping TERMS_VERSION in legalVersions.ts (the one
// source) must change both what acceptTerms records and what hasAcceptedTerms compares.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/legalVersions', () => ({ TERMS_VERSION: '2099-01-01', PRIVACY_VERSION: '2099-01-01' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { TERMS_KIND, TERMS_VERSION, acceptTerms, hasAcceptedTerms } from '../termsConsent';

const consentsAt = (version: string) => (fn: string) =>
  Promise.resolve(
    fn === 'dancer_area_gate_v1'
      ? { data: { allowed: true }, error: null }
      : { data: { consents: [{ kind: TERMS_KIND, version }] }, error: null },
  );

beforeEach(() => h.rpc.mockReset());

describe('L27 terms version: one source (legalVersions.ts)', () => {
  it('termsConsent re-exports the bumped legalVersions value', () => {
    expect(TERMS_VERSION).toBe('2099-01-01');
  });
  it('acceptTerms records the bumped version', async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    await acceptTerms();
    expect(h.rpc).toHaveBeenCalledWith('accept_terms_v1', { p_kind: TERMS_KIND, p_version: '2099-01-01' });
  });
  it('an acceptance of the old version no longer counts after the bump (re-asks)', async () => {
    h.rpc.mockImplementation(consentsAt('2026-10-16'));
    expect(await hasAcceptedTerms()).toBe(false);
  });
  it('an acceptance of the bumped version counts', async () => {
    h.rpc.mockImplementation(consentsAt('2099-01-01'));
    expect(await hasAcceptedTerms()).toBe(true);
  });
});
