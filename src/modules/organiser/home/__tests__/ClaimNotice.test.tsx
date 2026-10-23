// @vitest-environment jsdom
/**
 * Review finding 7: the "You now manage X" notice is a line in Home's own flow (never an overlay
 * on Home's rows) with a visible 44 px Close, and stays until closed. AuthCallback keeps it in
 * sessionStorage (lib/claimMyOrganisers); Home draws it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClaimNotice } from '../ClaimNotice';
import { readClaimNotice, stashClaimNotice } from '@/lib/claimMyOrganisers';

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('ClaimNotice on Home (finding 7)', () => {
  it('draws nothing when nothing was claimed', () => {
    const { container } = render(<ClaimNotice />);
    expect(container.innerHTML).toBe('');
  });

  it('says what was claimed, in flow, with Tell us and a visible 44 px Close', () => {
    stashClaimNotice([{ organiserId: 'o1', name: 'Ritmo' }, { organiserId: 'o2', name: 'Salsa Club' }]);
    render(<ClaimNotice />);
    const notice = screen.getByTestId('home-claim-notice');
    expect(notice.textContent).toContain('You now manage Ritmo and Salsa Club.');
    // In flow: never fixed or absolute, so it cannot sit over Home's rows.
    expect(notice.className).not.toMatch(/\b(fixed|absolute|sticky)\b/);
    const tell = screen.getByTestId('home-claim-notice-tell-us') as HTMLAnchorElement;
    expect(tell.href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(tell.href)).toContain('Ritmo, Salsa Club');
    expect(tell.className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.textContent).toBe('Close');
    expect(close.className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
    expect(close.className).toMatch(/(^|\s)min-w-\[44px\](\s|$)/);
    expect(close.className).not.toMatch(/opacity-0/);
  });

  it('stays until closed; Close removes it for good', () => {
    stashClaimNotice([{ organiserId: 'o1', name: 'Ritmo' }]);
    const first = render(<ClaimNotice />);
    expect(screen.getByTestId('home-claim-notice')).toBeTruthy();
    first.unmount();
    render(<ClaimNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('home-claim-notice')).toBeNull();
    expect(readClaimNotice()).toEqual([]);
  });

  it('unreadable storage draws nothing and never throws', () => {
    sessionStorage.setItem('bc_org_claim_notice_v1', '{not json');
    expect(() => render(<ClaimNotice />)).not.toThrow();
    expect(screen.queryByTestId('home-claim-notice')).toBeNull();
  });

  it('Home renders it above the job list', () => {
    const src = readFileSync(join(__dirname, '..', 'index.tsx'), 'utf8');
    const at = src.indexOf('<ClaimNotice');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(src.indexOf('data-testid="home-jobs"'));
  });
});
