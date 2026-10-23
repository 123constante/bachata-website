/**
 * FIX-RELEASE-A-WEB #14: the "finish your dancer profile first" sentence is
 * written ONCE (selfServeErrors.ts), and the Team switch's note imports it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));

import { PROFILE_REQUIRED_NOTE, TEAM_COPY } from '@/modules/organiser/shared/selfServeErrors';
import { NO_PROFILE_NOTE } from '../PublicToggle';

describe('one profile-required sentence', () => {
  it('the refusal copy and the switch note are the same constant', () => {
    expect(TEAM_COPY.profile_required).toBe(PROFILE_REQUIRED_NOTE);
    expect(NO_PROFILE_NOTE).toBe(PROFILE_REQUIRED_NOTE);
  });

  it('PublicToggle.tsx writes no copy of its own', () => {
    const src = readFileSync(resolve(__dirname, '../PublicToggle.tsx'), 'utf8');
    expect(src).not.toMatch(/Finish your dancer profile/);
  });
});
