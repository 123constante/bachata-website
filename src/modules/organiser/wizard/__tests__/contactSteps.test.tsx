// @vitest-environment jsdom
/**
 * Invite W2: the wizard's phone and Instagram steps use the ONE shared input and rule, so they save
 * exactly what the edit screens save. Table: each step x {untouched legacy, typed valid, typed refused, blank}.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));

import { WIZARD_STEPS } from '../registry';
import { SKIP_LABEL } from '../stepKinds';
import { PHONE_INCOMPLETE } from '../contactSteps';
import { INSTAGRAM_POST_LINK, INSTAGRAM_PROBLEM_COPY } from '@/lib/instagramHandle';
import { dancerSaveMessage } from '../dancerApi';

afterEach(cleanup);

function mountStep(key: string, value: unknown = null, required = false) {
  const entry = WIZARD_STEPS.get(key)!;
  const Step = entry.Component;
  const onAnswer = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Step field={entry.field} value={value} required={required} saving={false} error={null} onAnswer={onAnswer} onSkip={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onAnswer;
}

const box = () => screen.getByRole('textbox') as HTMLInputElement;
const cont = () => fireEvent.click(screen.getByTestId('step-continue'));

describe.each(['dancer:phone_or_whatsapp', 'organiser:contact_phone'])('phone step %s', (key) => {
  it('a typed or pasted number saves E.164', () => {
    const onAnswer = mountStep(key);
    fireEvent.change(box(), { target: { value: '0044 7700 900123' } });
    cont();
    expect(onAnswer).toHaveBeenCalledWith('+447700900123');
  });

  it('an incomplete number sends nothing and says what to do', () => {
    const onAnswer = mountStep(key);
    fireEvent.change(box(), { target: { value: '7700' } });
    cont();
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByTestId('step-error').textContent).toBe(PHONE_INCOMPLETE);
  });

  it('an untouched legacy number is shown as it is and Continue sends the same value (no change)', () => {
    const onAnswer = mountStep(key, '1234567');
    expect(screen.getByTestId('phone-legacy-value').textContent).toBe('1234567');
    cont();
    expect(onAnswer).toHaveBeenCalledWith('1234567');
  });

  it('blank and optional: only Skip', () => {
    mountStep(key);
    expect(screen.getByText(SKIP_LABEL)).toBeTruthy();
    expect(screen.queryByTestId('step-continue')).toBeNull();
  });
});

describe.each(['dancer:instagram', 'organiser:instagram'])('instagram step %s', (key) => {
  it.each([
    ['@Ritmo_Bachata', 'ritmo_bachata'],
    ['https://www.instagram.com/ritmo.bachata/?igsh=1', 'ritmo.bachata'],
  ])('%s saves the bare lowercase name', (typed, saved) => {
    const onAnswer = mountStep(key);
    fireEvent.change(box(), { target: { value: typed } });
    cont();
    expect(onAnswer).toHaveBeenCalledWith(saved);
  });

  it.each([
    ['rit..mo', INSTAGRAM_PROBLEM_COPY.dots],
    ['https://www.instagram.com/p/Cabc123/', INSTAGRAM_POST_LINK],
    ['@', INSTAGRAM_PROBLEM_COPY.no_name],
  ])('%s sends nothing and says what to change', (typed, copy) => {
    const onAnswer = mountStep(key);
    fireEvent.change(box(), { target: { value: typed } });
    cont();
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByTestId('step-error').textContent).toBe(copy);
  });

  it('an untouched legacy 34-character name is not checked and Continue sends the same value', () => {
    const legacy = 'abcdefghij0123456789abcdefghijklmn';
    const onAnswer = mountStep(key, legacy);
    expect(screen.queryByTestId('step-error')).toBeNull();
    cont();
    expect(onAnswer).toHaveBeenCalledWith(legacy);
  });
});

describe('server refusal copy', () => {
  it.each(['invalid_phone', 'invalid_instagram'])('%s reads as plain words, not the code', (code) => {
    const m = dancerSaveMessage(`new row violates: ${code}`);
    expect(m).not.toMatch(/invalid_/);
    expect(m).not.toMatch(/not saved\. Try again/);
  });
});
