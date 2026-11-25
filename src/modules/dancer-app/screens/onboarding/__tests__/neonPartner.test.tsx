// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NeonPartner } from '../neon/NeonPartner';
import type { PartnerDraftV3 } from '../modelV3';

afterEach(cleanup);

const empty: PartnerDraftV3 = { answer: null, kinds: [], role: null, years: null, details: '' };
const setup = (draft: PartnerDraftV3, sheet = false) => {
  const p = { onAnswer: vi.fn(), onChange: vi.fn(), onOpenSheet: vi.fn(), onSave: vi.fn(), onContinue: vi.fn() };
  render(<NeonPartner draft={draft} sheet={sheet} busy={false} error={null} {...p} />);
  return p;
};
const disabled = (id: string) => (screen.getByTestId(id) as HTMLButtonElement).disabled;

describe('neon partner', () => {
  it('keep-list: heading, sub, two rows, Continue disabled until answered', () => {
    const p = setup(empty);
    expect(screen.getByRole('heading').textContent).toBe('Looking for a dance partner?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Say yes and we show you to dancers who want a partner.');
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['\u{1F91D}Yes, I am', '\u{1F642}No, just social dancing']);
    expect(disabled('onboarding-continue')).toBe(true);
    fireEvent.click(screen.getByTestId('onboarding-partner-yes'));
    expect(p.onAnswer).toHaveBeenCalledWith('yes');
  });

  it('No advances on Continue', () => {
    const p = setup({ ...empty, answer: 'no' });
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    expect(p.onContinue).toHaveBeenCalled();
  });

  it('Yes + incomplete: Continue reopens the sheet and does not advance', () => {
    const p = setup({ ...empty, answer: 'yes' });
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    expect(p.onOpenSheet).toHaveBeenCalled();
    expect(p.onContinue).not.toHaveBeenCalled();
  });

  it('Yes + complete: Continue advances', () => {
    const p = setup({ ...empty, answer: 'yes', kinds: ['Practice'], role: 'Leader', years: 'any' });
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    expect(p.onContinue).toHaveBeenCalled();
  });

  it('sheet: Save disabled until kind + role + years, hint text exact', () => {
    const { rerender } = render(<NeonPartner draft={{ ...empty, answer: 'yes' }} sheet busy={false} error={null} onAnswer={vi.fn()} onChange={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Your ideal partner' })).toBeTruthy();
    expect(screen.getByTestId('partner-hint').textContent).toBe('Pick a kind, their role and years dancing to save.');
    expect(disabled('partner-sheet-save')).toBe(true);
    rerender(<NeonPartner draft={{ ...empty, answer: 'yes', kinds: ['Practice'], role: 'Lead and Follow', years: '5+' }} sheet busy={false} error={null} onAnswer={vi.fn()} onChange={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.queryByTestId('partner-hint')).toBeNull();
    expect(disabled('partner-sheet-save')).toBe(false);
  });

  it('sheet chips: kind toggles, role and years set, Save fires onSave', () => {
    const p = setup({ ...empty, answer: 'yes', kinds: ['Practice'], role: 'Leader', years: 'any' }, true);
    expect(screen.getAllByRole('checkbox').map((c) => c.textContent)).toEqual(['Social dancing', 'Classes', 'Performance', 'Competition']);
    fireEvent.click(screen.getByTestId('partner-kind-Practice'));
    expect(p.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kinds: [] }));
    fireEvent.click(screen.getByTestId('partner-role-Either'));
    expect(p.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'Lead and Follow' }));
    fireEvent.click(screen.getByTestId('partner-years-5+'));
    expect(p.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: '5+' }));
    fireEvent.click(screen.getByTestId('partner-sheet-save'));
    expect(p.onSave).toHaveBeenCalled();
  });
});
