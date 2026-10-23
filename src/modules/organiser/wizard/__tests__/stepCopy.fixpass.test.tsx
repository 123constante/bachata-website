// @vitest-environment jsdom
/**
 * FIX-RELEASE-A-WEB, wizard copy:
 *  #6  every organiser step names its field with My page's ONE label map (FIELD_LABEL), never a second one.
 *  #10 the list step's disabled Add says why, on screen, linked by aria-describedby.
 *  #11 the phone step's help names the switch on My page AND links there.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));

import { FIELD_LABEL } from '../../edit-in-place/fieldRules';
import { ORG_PATHS } from '../../shell/paths';
import { WIZARD_STEPS } from '../registry';
import { LIST_ADD_HINT } from '../stepKinds';

afterEach(cleanup);

function mountStep(key: string, required = false) {
  const entry = WIZARD_STEPS.get(key)!;
  const Step = entry.Component;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Step field={entry.field} value={null} required={required} saving={false} error={null} onAnswer={() => {}} onSkip={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return entry;
}

/** The step's field name for screen readers: its sr-only label, or the choice group's aria-label. */
const fieldName = () =>
  (document.querySelector('label.sr-only') as HTMLLabelElement | null)?.textContent
  ?? document.querySelector('[role="group"]')?.getAttribute('aria-label');

const ORG_KEYS = [...WIZARD_STEPS.values()].filter((e) => e.organiserField).map((e) => `${e.area}:${e.field}`);

describe('#6 organiser steps read FIELD_LABEL', () => {
  it('there are organiser steps to check', () => expect(ORG_KEYS.length).toBeGreaterThanOrEqual(10));

  it.each(ORG_KEYS)('%s', (key) => {
    const entry = mountStep(key);
    expect(fieldName()).toBe(FIELD_LABEL[entry.organiserField!]);
  });
});

describe('#10 list step: a disabled Add says why', () => {
  it('empty: Add is off and points at the visible reason; typing removes both', () => {
    mountStep('dancer:languages');
    const add = screen.getByTestId('step-list-add') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    const reason = document.getElementById(add.getAttribute('aria-describedby') ?? '');
    expect(reason?.textContent).toBe(LIST_ADD_HINT);
    expect(reason?.className).not.toContain('sr-only');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Spanish' } });
    expect(add.disabled).toBe(false);
    expect(add.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByText(LIST_ADD_HINT)).toBeNull();
  });
});

describe('#11 phone help links to My page', () => {
  it('the hint names My page as a link to it, at least 44 px tall', () => {
    mountStep('organiser:contact_phone');
    const link = screen.getByRole('link', { name: 'My page' });
    expect(link.getAttribute('href')).toBe(ORG_PATHS.page);
    expect(screen.getByTestId('step-hint').contains(link)).toBe(true);
    expect(link.className).toMatch(/min-h-\[44px\]/);
  });
});
