// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BioNeon, PhotoNeon } from '../neon/NeonPhotoBio';

afterEach(cleanup);
const foot = { busy: false, error: null };
const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement;

describe('neon photo keep-list', () => {
  it('empty: heading, sub, camera circle, Continue disabled with a reason', () => {
    const onPick = vi.fn();
    render(<PhotoNeon {...foot} photoUrl={null} onPickPhoto={onPick} onContinue={vi.fn()} />);
    expect(screen.getByRole('heading').textContent).toBe('Show us your face');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('A photo is required. Partners and organisers need to know who you are.');
    expect(btn('onboarding-photo-tile').textContent).toBe('\u{1F4F8}Tap to add a photo');
    expect(btn('onboarding-photo-tile').className).toBe('photoadd');
    expect(btn('onboarding-continue').disabled).toBe(true);
    expect(screen.getByTestId('onboarding-reason')).toBeTruthy();
    fireEvent.click(btn('onboarding-photo-tile'));
    expect(onPick).toHaveBeenCalled();
  });

  it('with a photo: circle stays the stick figure (no <img>), label changes, Continue enabled', () => {
    const onContinue = vi.fn();
    const { container } = render(<PhotoNeon {...foot} photoUrl="https://x/y.jpg" onPickPhoto={vi.fn()} onContinue={onContinue} />);
    expect(container.querySelector('img')).toBeNull();
    expect(btn('onboarding-photo-tile').className).toBe('photoadd on');
    expect(btn('onboarding-photo-tile').textContent).toBe('\u{1F9D1}Photo added. Tap to change');
    expect(btn('onboarding-continue').disabled).toBe(false);
    fireEvent.click(btn('onboarding-continue'));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('neon bio keep-list', () => {
  const props = { ...foot, bio: '', link: '', onBio: vi.fn(), onLink: vi.fn(), onContinue: vi.fn(), onSkip: vi.fn() };

  it('journey: copy, rows 3, Finish, Skip for now, Next line', () => {
    render(<BioNeon {...props} />);
    expect(screen.getByRole('heading').textContent).toBe('Tell us about you');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Optional. Skip any time.');
    expect((screen.getByTestId('onboarding-bio-input') as HTMLTextAreaElement).rows).toBe(3);
    expect(screen.getByPlaceholderText('A short bio (optional)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Instagram or other link (optional)')).toBeTruthy();
    expect(btn('onboarding-finish').textContent).toBe('Finish');
    expect(btn('onboarding-skip').textContent).toBe('Skip for now');
    expect(screen.getByText('Next: your real Home, exactly as today.')).toBeTruthy();
    fireEvent.click(btn('onboarding-finish'));
    fireEvent.click(btn('onboarding-skip'));
    expect(props.onContinue).toHaveBeenCalled();
    expect(props.onSkip).toHaveBeenCalled();
  });

  it('bio-only variant: own copy, rows 4, Save and Not now, no Next line', () => {
    render(<BioNeon {...props} bioOnly />);
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Add a bio and a link so dancers know you. You can change this any time on Me.');
    expect((screen.getByTestId('onboarding-bio-input') as HTMLTextAreaElement).rows).toBe(4);
    expect(screen.getByPlaceholderText('A short bio')).toBeTruthy();
    expect(screen.getByPlaceholderText('Instagram or other link')).toBeTruthy();
    expect(btn('onboarding-finish').textContent).toBe('Save');
    expect(btn('onboarding-skip').textContent).toBe('Not now');
    expect(screen.queryByText('Next: your real Home, exactly as today.')).toBeNull();
  });
});
