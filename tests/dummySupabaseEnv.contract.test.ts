import { describe, expect, it } from 'vitest';

// A *.contract.test.* file (a live-DB suite) must never see the vitest-only dummy Supabase values: with no env it sees it ABSENT
// (and skips or fails honestly), never a fake host. Guards the testPath lookup in vitest.setup.ts (a first version applied the dummy here).
describe('live-DB suites never see the dummy Supabase env', () => {
  it('neither dummy value is present in a contract-named file', () => {
    expect(process.env.VITE_SUPABASE_URL).not.toBe('https://dummy-vitest.invalid');
    expect(process.env.VITE_SUPABASE_PUBLISHABLE_KEY).not.toBe('dummy-vitest-publishable-key');
  });
});
