// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProfileStep, type ProfileChrome } from '../ProfileStep';
import { PhotoStep } from '../PhotoStep';
import { NameStep } from '../NameStep';
import { RoleStep } from '../RoleStep';

vi.mock('@/lib/uploadToR2', () => ({ uploadToR2: vi.fn() }));

const mk = (over: Partial<ProfileChrome> = {}): ProfileChrome => ({
  index: 0, total: 3, intro: 'We need a few details before we can give you your QR.',
  night: { date: 'Thu 26 Nov', title: 'Sensual Thursdays' }, onBack: vi.fn(), onBackToPick: vi.fn(), ...over,
});
const noop = () => {};
afterEach(cleanup);

describe('shell chrome', () => {
  it('back arrow on the first step goes to pick, later steps go back one', () => {
    const first = mk();
    const { unmount } = render(<ProfileStep chrome={first} heading="H" canContinue onContinue={noop}>x</ProfileStep>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(first.onBackToPick).toHaveBeenCalledTimes(1);
    expect(first.onBack).not.toHaveBeenCalled();
    unmount();
    const later = mk({ index: 1, intro: 'x' });
    render(<ProfileStep chrome={later} heading="H" canContinue onContinue={noop}>x</ProfileStep>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(later.onBack).toHaveBeenCalledTimes(1);
    expect(later.onBackToPick).not.toHaveBeenCalled();
  });

  it('progress, segments, night chip, intro on first step only', () => {
    const { unmount } = render(<NameStep value="" onChange={noop} onContinue={noop} chrome={mk({ index: 1, total: 3 })} />);
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    const segs = screen.getByTestId('profile-segments').querySelectorAll('i');
    expect([...segs].map((s) => s.getAttribute('data-on'))).toEqual(['true', 'true', 'false']);
    expect(screen.getByText('Thu 26 Nov, Sensual Thursdays')).toBeTruthy();
    expect(screen.queryByText(/We need a few details/)).toBeNull();
    unmount();
    render(<NameStep value="" onChange={noop} onContinue={noop} chrome={mk()} />);
    expect(screen.getByText('We need a few details before we can give you your QR.')).toBeTruthy();
  });

  it('existing-account intro line is shown as given', () => {
    render(<NameStep value="" onChange={noop} onContinue={noop} chrome={mk({ intro: 'Almost there. We need a few more details.' })} />);
    expect(screen.getByText('Almost there. We need a few more details.')).toBeTruthy();
  });

  it('no Skip button on any step', () => {
    render(<RoleStep value="" onChange={noop} onContinue={noop} chrome={mk()} />);
    expect(screen.queryByText(/skip/i)).toBeNull();
  });
});

describe('PhotoStep', () => {
  it('empty: copy and disabled Continue', () => {
    render(<PhotoStep value="" onChange={noop} onContinue={noop} chrome={mk()} userId="u" />);
    expect(screen.getByRole('heading', { name: 'Add a photo of you' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('set: Retake / Choose another and Continue enabled', () => {
    const onContinue = vi.fn();
    render(<PhotoStep value="https://x/a.png" onChange={noop} onContinue={onContinue} chrome={mk()} userId="u" />);
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose another' })).toBeTruthy();
    const c = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(c.disabled).toBe(false);
    fireEvent.click(c);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('NameStep', () => {
  it('heading, placeholder, disabled until non-blank', () => {
    const onChange = vi.fn();
    const { rerender } = render(<NameStep value="  " onChange={onChange} onContinue={noop} chrome={mk()} />);
    expect(screen.getByRole('heading', { name: 'What is your first name?' })).toBeTruthy();
    const input = screen.getByPlaceholderText('First name');
    fireEvent.change(input, { target: { value: 'Maya' } });
    expect(onChange).toHaveBeenCalledWith('Maya');
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<NameStep value="Maya" onChange={onChange} onContinue={noop} chrome={mk()} />);
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('RoleStep', () => {
  it('Leader / Follower / Both, Both stores Lead and Follow, single select', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RoleStep value="" onChange={onChange} onContinue={noop} chrome={mk()} />);
    expect(screen.getByRole('heading', { name: 'Which role do you dance?' })).toBeTruthy();
    expect(['Leader', 'Follower', 'Both'].map((n) => !!screen.getByRole('button', { name: n }))).toEqual([true, true, true]);
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    expect(onChange).toHaveBeenCalledWith('Lead and Follow');
    rerender(<RoleStep value="Lead and Follow" onChange={onChange} onContinue={noop} chrome={mk()} />);
    expect(screen.getByRole('button', { name: 'Both' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Leader' }).getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
