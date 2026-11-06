// @vitest-environment jsdom
/** Edit opened from a checklist row: the note, both Back targets, the bottom label and the Discard target. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';

afterEach(() => {
  cleanup();
  resetShell();
});

// The P3 review route is not on main; any path the test shell routes without redirecting stands in for it.
const REVIEW = '/account/o/review';
const NOTE = 'Save your changes and you come straight back to where you were.';
const returnCases: Array<{ name: string; param: string | null; target: string | null }> = [
  { name: 'none', param: null, target: null },
  { name: 'valid P3 review path', param: REVIEW, target: REVIEW },
  { name: 'the editor itself', param: '/app/me/edit', target: null },
  { name: 'off-site', param: 'https://evil.example', target: null },
  { name: 'malformed', param: '//evil.example', target: null },
];
const focusCases = [
  { name: 'instagram', param: 'instagram' },
  { name: 'none', param: null },
] as const;

describe('Edit return matrix', () => {
  for (const r of returnCases) {
    for (const f of focusCases) {
      for (const dirty of [false, true]) {
        it(`returnTo ${r.name} x focus ${f.name} x unsaved ${dirty ? 'yes' : 'no'}`, async () => {
          const q = new URLSearchParams();
          if (r.param) q.set('returnTo', r.param);
          if (f.param) q.set('focus', f.param);
          const qs = q.toString();
          const { location } = renderInShell({ path: `/app/me/edit${qs ? `?${qs}` : ''}` });
          const header = await screen.findByTestId('edit-header-back');
          const target = r.target ?? '/app/me';
          const bottom = screen.getByRole('link', { name: r.target ? 'Back to where you were' : 'Back to Me' });
          expect(header.getAttribute('href')).toBe(target);
          expect(bottom.getAttribute('href')).toBe(target);
          const note = screen.queryByTestId('edit-return-note');
          if (!r.target) expect(note).toBeNull();
          else expect(note?.textContent).toBe(f.param ? `Add your Instagram, then save. ${NOTE}` : NOTE);

          if (dirty) {
            fireEvent.change(document.getElementById('first_name') as HTMLInputElement, { target: { value: 'Zed' } });
            fireEvent.click(header);
            expect(location()).toContain('/app/me/edit');
            fireEvent.click(await screen.findByTestId('edit-discard'));
            expect(location()).toBe(target);
          }
        });
      }
    }
  }
});
