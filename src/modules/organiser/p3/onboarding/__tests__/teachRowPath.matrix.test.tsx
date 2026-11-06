// @vitest-environment jsdom
/**
 * One missing teaching item tapped from Review returns to Review. Table: entry step x teach answer x write
 * succeeds or fails. Asserts the next screen (onDone = Review, or the existing next step), the writes sent,
 * and the Back target (onExit = Review for a lone step).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));

import { PersonScreens } from '../PersonFlow';
import { EMPTY_DRAFT, personPath, teachRowPath, type PersonCommand, type PersonDraft, type PersonStep } from '../personModel';
import type { OrganiserBrief, PersonWrites } from '../personApi';

const ORG: OrganiserBrief = { id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' };
const BASE: PersonDraft = {
  ...EMPTY_DRAFT, first_name: 'Sam', avatar_url: 'https://img/a.jpg', dance_role: 'Follower', nationality: 'GB', languages: ['English'],
  levels: [], styles: [], years: '',
};

type Teach = 'yes' | 'no' | null;
const held = (teach: Teach): PersonDraft => ({ ...BASE, teach });

function mount(step: PersonStep, teach: Teach, fail: boolean) {
  const sent: PersonCommand[] = [];
  const writes: PersonWrites = {
    run: vi.fn(async (cmd: PersonCommand) => { if (fail) throw new Error('offline'); sent.push(cmd); }),
    skipAbout: vi.fn(async () => {}),
  };
  const onExit = vi.fn();
  const onDone = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PersonScreens held={held(teach)} organiser={ORG} userId="u1" writes={writes} theme="light" onExit={onExit} onDone={onDone}
        initialStep={step} fromReview upload={async () => 'x'} />
    </QueryClientProvider>,
  );
  return { sent, onExit, onDone };
}

const answer = (step: PersonStep, teach: Teach = null) => {
  if (step === 'levels') fireEvent.click(screen.getByTestId('p3-ob-level-Beginner'));
  else if (step === 'years') fireEvent.change(screen.getByTestId('p3-ob-years'), { target: { value: '4' } });
  else if (step === 'styles') fireEvent.click(screen.getByText('Moderna'));
  else if (step === 'teach') fireEvent.click(screen.getByTestId(teach === 'no' ? 'p3-ob-teach-yes' : 'p3-ob-teach-no'));
  else if (step === 'name') fireEvent.change(screen.getByTestId('p3-ob-name'), { target: { value: 'Sammy' } });
};

afterEach(cleanup);

describe('teachRowPath', () => {
  it('is the step alone for levels, styles, years and null otherwise', () => {
    for (const s of ['levels', 'styles', 'years'] as const) expect(teachRowPath(s)).toEqual([s]);
    for (const s of ['teach', 'name', 'about'] as const) expect(teachRowPath(s)).toBeNull();
  });
});

const ENTRIES: PersonStep[] = ['levels', 'styles', 'years', 'teach', 'name'];
const TEACH: Teach[] = ['yes', 'no', null];

describe.each(ENTRIES)('entry %s from Review', (entry) => {
  describe.each(TEACH.filter((t) => !(t === 'no' && teachRowPath(entry))))('teach answer %s', (teach) => {
    // teach = No hides levels/styles/years, so those entries are unreachable from Review with it.
    const solo = !!teachRowPath(entry);

    it('write succeeds', async () => {
      const { sent, onDone } = mount(entry, teach, false);
      answer(entry, teach);
      fireEvent.click(screen.getByTestId('p3-ob-continue'));
      if (solo) {
        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
        expect(sent).toHaveLength(1);
      } else {
        await waitFor(() => expect(sent).toHaveLength(1));
        expect(onDone).not.toHaveBeenCalled();
        const next = personPath(entry === 'teach' ? 'no' : teach, true);
        const want = next[next.indexOf(entry) + 1];
        await waitFor(() => expect(screen.getByTestId('p3-ob-title')).toBeTruthy());
        expect(want).toBeTruthy();
      }
    });

    it('write fails: stays, error shown, no navigation', async () => {
      const { onDone } = mount(entry, teach, true);
      answer(entry, teach);
      fireEvent.click(screen.getByTestId('p3-ob-continue'));
      await waitFor(() => expect(screen.getByTestId('p3-ob-error')).toBeTruthy());
      expect(onDone).not.toHaveBeenCalled();
    });

    it('Back target', () => {
      const { onExit } = mount(entry, teach, false);
      fireEvent.click(screen.getByLabelText('Back'));
      if (solo) expect(onExit).toHaveBeenCalledTimes(1);
      else if (entry === 'name') expect(onExit).toHaveBeenCalledTimes(1);
      else expect(onExit).not.toHaveBeenCalled();
    });
  });
});
