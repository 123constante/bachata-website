// @vitest-environment jsdom
/**
 * Invite W2: the wizard's phone and Instagram steps use the ONE shared input and rule, so they save
 * exactly what the edit screens save. Table: each step x {untouched legacy, typed valid, typed refused, blank}.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));

import { WIZARD_STEPS } from '../registry';
import { SKIP_LABEL } from '../stepKinds';
import { INSTAGRAM_POST_LINK, INSTAGRAM_PROBLEM_COPY } from '@/lib/instagramHandle';
import { dancerSaveMessage } from '../dancerApi';
import { selfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';

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

  it('typed digit by digit (a real phone keyboard), the box stays and the number saves as E.164', async () => {
    const onAnswer = mountStep(key);
    const user = userEvent.setup();
    await user.type(box(), '7');
    expect(screen.queryByTestId('phone-legacy')).toBeNull();
    await user.type(box(), '700900123');
    expect(box().value).toBe('7700900123');
    cont();
    expect(onAnswer).toHaveBeenCalledWith('+447700900123');
  });

  it('typed "77" digit by digit: the box keeps 77 and, once left, says the number is short', async () => {
    mountStep(key);
    const user = userEvent.setup();
    await user.type(box(), '77');
    expect(screen.queryByTestId('phone-legacy')).toBeNull();
    expect(box().value).toBe('77');
    await user.tab();
    expect(screen.getByTestId('phone-feedback').textContent).toBe('Looks short. United Kingdom numbers have 10 digits after +44.');
  });

  it('an incomplete number sends nothing and says what to do', () => {
    const onAnswer = mountStep(key);
    fireEvent.change(box(), { target: { value: '7700' } });
    cont();
    expect(onAnswer).not.toHaveBeenCalled();
    // One message, the field's own, saying what is missing (never a second step error).
    expect(screen.getByTestId('phone-feedback').textContent).toBe('Looks short. United Kingdom numbers have 10 digits after +44.');
    expect(screen.queryByTestId('step-error')).toBeNull();
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

  it('the organiser and dancer Instagram refusals say the same rule: bare name, @name or a link', () => {
    const organiser = selfServeErrorCopy({ message: 'invalid_instagram' }).message;
    expect(organiser).toBe(dancerSaveMessage('invalid_instagram'));
    expect(organiser).toMatch(/yourname or @yourname, or your profile link/);
  });
});
