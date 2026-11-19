// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { MapEvent } from '../mapTypes';
import { fitBox, nearestVenues, padBox } from '../nearFit';
import { NearMeSweep } from '../NearMeSweep';

afterEach(cleanup);
const ev = (id: string, lat: number | null, lng: number | null) => ({ occurrence_id: id, lat, lng }) as unknown as MapEvent;
const user = { lat: 51.5, lng: -0.1 };

describe('nearestVenues', () => {
  it('picks the 5 nearest distinct places, nearest first', () => {
    const evs = [1, 2, 3, 4, 5, 6, 7].map((i) => ev(`o${i}`, 51.5 + i * 0.01, -0.1));
    evs.push(ev('dup', 51.51, -0.1), ev('nocoord', null, null));
    const v = nearestVenues(evs, user);
    expect(v).toHaveLength(5);
    expect(v.map((p) => p.lat)).toEqual([51.51, 51.52, 51.53, 51.54, 51.55]);
  });
  it('copes with fewer than 5, none, and no user', () => {
    expect(nearestVenues([ev('a', 51.6, -0.1)], user)).toHaveLength(1);
    expect(nearestVenues([], user)).toEqual([]);
    expect(nearestVenues([ev('a', 51.6, -0.1)], null)).toEqual([]);
  });
});

describe('fitBox / padBox', () => {
  it('holds the user and every venue', () => {
    expect(fitBox(user, [{ lat: 51.6, lng: -0.3 }, { lat: 51.4, lng: 0 }])).toEqual([[51.4, -0.3], [51.6, 0]]);
  });
  it('pads 50 percent of the span each side', () => {
    const [[s, w], [n, e]] = padBox([[51.4, -0.3], [51.6, 0]], 0.5);
    expect(s).toBeCloseTo(51.3); expect(n).toBeCloseTo(51.7); expect(w).toBeCloseTo(-0.45); expect(e).toBeCloseTo(0.15);
  });
  it('never returns a point box when the user is alone', () => {
    const [[s], [n]] = padBox(fitBox(user, []));
    expect(n).toBeGreaterThan(s);
  });
});

describe('NearMeSweep', () => {
  it('renders only while waiting', () => {
    const ref = createRef<HTMLElement>();
    const { container, rerender } = render(<NearMeSweep waiting={false} anchorRef={ref} />);
    expect(container.querySelector('[data-testid="near-sweep"]')).toBeNull();
    rerender(<NearMeSweep waiting anchorRef={ref} />);
    const el = container.querySelector('[data-testid="near-sweep"]');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('');
    rerender(<NearMeSweep waiting={false} anchorRef={ref} />);
    expect(container.querySelector('[data-testid="near-sweep"]')).toBeNull();
  });
});

describe('CSS', () => {
  const css = readFileSync(resolve(__dirname, '../homeMap.css'), 'utf8');
  const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  it('sweep never takes taps and has a reduced-motion rule', () => {
    expect(css).toMatch(/\.hm-sweep\s*\{[^}]*pointer-events:\s*none/);
    expect(rm).toMatch(/\.hm-sweep-arm[^{]*\{[^}]*animation:\s*none/);
  });
  it('breathe + twinkle are opted out under reduced motion', () => {
    expect(rm).toMatch(/\.leaflet-tile-pane[^{]*\{[^}]*animation:\s*none/);
  });
});
