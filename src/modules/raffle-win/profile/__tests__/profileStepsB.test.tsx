// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguagesStep } from '../LanguagesStep';
import { ProfileSteps } from '../ProfileSteps';
import type { ProfileChrome } from '../ProfileStep';

vi.mock('@/lib/uploadToR2', () => ({ uploadToR2: vi.fn() }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string) => void }) => <button type="button" onClick={() => onChange('c1')}>pick city</button>,
}));
vi.mock('@/components/ui/nationality-picker', () => ({
  NationalityPicker: ({ onChange }: { onChange: (v: string) => void }) => <button type="button" onClick={() => onChange('Spain')}>pick nationality</button>,
}));
vi.mock('@/modules/dancer-app/screens/edit/editModel', () => ({ nationalityCodeForPick: (p: string) => (p === 'Spain' ? 'ES' : p) }));

const night = { date: 'Thu 26 Nov', title: 'Sensual Thursdays' };
const chrome = (over: Partial<ProfileChrome> = {}): ProfileChrome => ({
  index: 0, total: 1, intro: null, night, onBack: vi.fn(), onBackToPick: vi.fn(), ...over,
});
const cont = () => screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
afterEach(cleanup);

describe('LanguagesStep', () => {
  it('heading, hint, multi select, disabled until one', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<LanguagesStep value={[]} onChange={onChange} onContinue={() => {}} chrome={chrome()} />);
    expect(screen.getByRole('heading', { name: 'Which languages do you speak?' })).toBeTruthy();
    expect(screen.getByText('Pick every one that applies.')).toBeTruthy();
    expect(cont().disabled).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Spanish' }));
    expect(onChange).toHaveBeenCalledWith(['Spanish']);
    rerender(<LanguagesStep value={['Spanish']} onChange={onChange} onContinue={() => {}} chrome={chrome()} />);
    expect(cont().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe('ProfileSteps flow', () => {
  const base = { isNewAccount: true, night, userId: 'u', onBackToPick: vi.fn() };

  it('shows only missing steps, counted over missing only, intro on first, saves each, then onDone', async () => {
    const save = vi.fn().mockResolvedValue({ error: null });
    const onDone = vi.fn();
    render(<ProfileSteps {...base} missing={['nationality', 'based_city_id']} save={save} onDone={onDone} />);
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Where are you based?' })).toBeTruthy();
    expect(screen.getByText('We need a few details before we can give you your QR.')).toBeTruthy();
    expect(screen.getByText('Thu 26 Nov, Sensual Thursdays')).toBeTruthy();
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByText('pick city'));
    fireEvent.click(cont());
    await waitFor(() => expect(screen.getByText('Step 2 of 2')).toBeTruthy());
    expect(save).toHaveBeenCalledWith({ based_city_id: 'c1' });
    expect(screen.getByRole('heading', { name: 'What is your nationality?' })).toBeTruthy();
    expect(screen.queryByText(/We need a few details/)).toBeNull();
    fireEvent.click(screen.getByText('pick nationality'));
    fireEvent.click(cont());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenLastCalledWith({ nationality: 'ES' });
  });

  it('existing account intro', () => {
    render(<ProfileSteps {...base} isNewAccount={false} missing={['dance_role']} save={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText('Almost there. We need a few more details.')).toBeTruthy();
  });

  it('role Both saves Lead and Follow', async () => {
    const save = vi.fn().mockResolvedValue({ error: null });
    render(<ProfileSteps {...base} missing={['dance_role']} save={save} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    fireEvent.click(cont());
    await waitFor(() => expect(save).toHaveBeenCalledWith({ dance_role: 'Lead and Follow' }));
  });

  it('save error shows the step again, no advance, no Skip', async () => {
    const save = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const onDone = vi.fn();
    render(<ProfileSteps {...base} missing={['based_city_id', 'nationality']} save={save} onDone={onDone} />);
    fireEvent.click(screen.getByText('pick city'));
    fireEvent.click(cont());
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText(/skip/i)).toBeNull();
  });

  it('back: first step goes to pick, later steps go back one', async () => {
    const onBackToPick = vi.fn();
    const save = vi.fn().mockResolvedValue({ error: null });
    render(<ProfileSteps {...base} onBackToPick={onBackToPick} missing={['based_city_id', 'nationality']} save={save} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBackToPick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('pick city'));
    fireEvent.click(cont());
    await waitFor(() => expect(screen.getByText('Step 2 of 2')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(onBackToPick).toHaveBeenCalledTimes(1);
  });

  it('complete profile: onDone straight away, nothing shown', async () => {
    const onDone = vi.fn();
    const { container } = render(<ProfileSteps {...base} missing={[]} save={vi.fn()} onDone={onDone} />);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe('');
  });
});
