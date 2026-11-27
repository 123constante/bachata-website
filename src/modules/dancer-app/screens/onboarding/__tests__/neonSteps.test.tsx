// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RolesNeon, StylesNeon, YearsNeon } from '../neon/NeonSteps';

vi.mock('../useLazy', () => ({ useLazy: () => ({ FAVORITE_STYLE_OPTIONS: ['Bachata Sensual', 'Salsa On1'] }) }));
afterEach(cleanup);

const foot = { busy: false, error: null, onContinue: vi.fn() };

describe('neon keep-list', () => {
  it('roles: heading, sub, 4 rows in order with emoji, title, sub; Continue disabled with none; no Skip', () => {
    const onToggle = vi.fn();
    render(<RolesNeon {...foot} picked={[]} onToggle={onToggle} />);
    expect(screen.getByRole('heading').textContent).toBe('Who\u2019s hitting the floor?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Pick all that fit. Change anytime.');
    const rows = screen.getAllByRole('checkbox');
    expect(rows.map((r) => r.textContent)).toEqual(['\u{1F483}DancerFind nights and partners', '\u{1F39F}️OrganiserRun events and classes', '\u{1F393}TeacherShare your classes', '\u{1F3A7}DJPlay at nights']);
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    fireEvent.click(rows[1]);
    expect(onToggle).toHaveBeenCalledWith('organiser');
  });

  it('roles: a picked row shows its tick and enables Continue', () => {
    render(<RolesNeon {...foot} picked={['dancer']} onToggle={vi.fn()} />);
    expect(screen.getByTestId('onboarding-role-dancer-tick')).toBeTruthy();
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(false);
  });

  it('styles: heading, sub, live chips, Continue disabled until one is picked', () => {
    const { rerender } = render(<StylesNeon {...foot} picked={[]} onToggle={vi.fn()} />);
    expect(screen.getByRole('heading').textContent).toBe('Which styles do you dance?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Pick at least one.');
    expect(screen.getAllByRole('checkbox').map((c) => c.textContent)).toEqual(['Bachata Sensual', 'Salsa On1']);
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(true);
    rerender(<StylesNeon {...foot} picked={['Salsa On1']} onToggle={vi.fn()} />);
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(false);
  });

  it('years: heading, sub, 5 rows in order with calendar emoji; single pick; Continue disabled until picked', () => {
    const onPick = vi.fn();
    render(<YearsNeon {...foot} band={null} onPick={onPick} />);
    expect(screen.getByRole('heading').textContent).toBe('How long have you danced?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Required. We store the year you started.');
    const rows = screen.getAllByRole('radio');
    expect(rows.map((r) => r.textContent)).toEqual(['\u{1F4C5}Under 1 year', '\u{1F4C5}1 to 2 years', '\u{1F4C5}3 to 5 years', '\u{1F4C5}6 to 10 years', '\u{1F4C5}Over 10 years']);
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(rows[2]);
    expect(onPick).toHaveBeenCalledWith('three-five');
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
  });
});
