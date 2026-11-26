// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PhotoStep } from '../PhotoStep';
import { cropFor } from '../cutout';

vi.mock('@/lib/uploadToR2', () => ({ uploadToR2: vi.fn() }));
const flags = vi.hoisted(() => ({ raffleCutout: false }));
vi.mock('@/lib/featureFlags', () => ({ flags: flags }));

const chrome = {
  index: 0, total: 6, intro: 'intro',
  night: { date: 'Thu 26 Nov', title: 'Sensual Thursdays' }, onBack: vi.fn(), onBackToPick: vi.fn(),
};
const mount = () => render(<PhotoStep value="" onChange={() => {}} onContinue={() => {}} chrome={chrome} userId="u" name="Ana" />);
afterEach(() => { cleanup(); flags.raffleCutout = false; });

describe.each([false, true])('PhotoStep keep-list, cutout flag %s', (on) => {
  it('keeps heading, both buttons, both inputs and Continue', () => {
    flags.raffleCutout = on;
    mount();
    expect(screen.getByText('Add a photo of you')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeTruthy();
    expect(screen.getByTestId('photo-camera')).toBeTruthy();
    expect(screen.getByTestId('photo-library')).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    expect(screen.queryByTestId('photo-face-guide') !== null).toBe(on);
    expect(screen.queryByText('Fit your face and shoulders in the oval') !== null).toBe(on);
  });
});

describe('cropFor', () => {
  it('puts the face centre a third down the square', () => {
    const c = cropFor(1000, 1000, { originX: 400, originY: 300, width: 200, height: 200 });
    expect(c.sy + c.side / 3).toBeCloseTo(400);
    expect(c.sx + c.side / 2).toBeCloseTo(500);
  });
});
