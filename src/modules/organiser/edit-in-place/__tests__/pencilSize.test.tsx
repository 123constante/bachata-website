// @vitest-environment jsdom
/**
 * Owner decision (F-INT): the hero's compact pencils (city, year started,
 * category) are 44x44 on /page, which renders inside the organiser shell's
 * .org-theme. The public organiser page keeps its 32x44 compact pencils.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LAYER_CSS, PencilButton } from '../parts';

afterEach(cleanup);

const size = (inOrgTheme: boolean, compact: boolean) => {
  const pencil = <PencilButton field="city" onOpen={() => {}} compact={compact} style={compact ? { margin: '-6px 0' } : undefined} />;
  const { container } = render(
    <>
      <style>{LAYER_CSS}</style>
      {inOrgTheme ? <div className="org-theme">{pencil}</div> : pencil}
    </>,
  );
  const s = getComputedStyle(container.querySelector<HTMLElement>('[data-eip-pencil="city"]')!);
  return { width: s.width, minWidth: s.minWidth, height: s.height };
};

describe('compact pencil size by scope', () => {
  it('on /page (inside .org-theme) a compact pencil is 44x44', () => {
    expect(size(true, true)).toEqual({ width: '44px', minWidth: '44px', height: '44px' });
  });
  it('on the public page (no .org-theme) it stays 32x44', () => {
    expect(size(false, true)).toEqual({ width: '32px', minWidth: '32px', height: '44px' });
  });
  it('a full pencil is 44x44 everywhere', () => {
    expect(size(false, false)).toEqual({ width: '44px', minWidth: '44px', height: '44px' });
    cleanup();
    expect(size(true, false)).toEqual({ width: '44px', minWidth: '44px', height: '44px' });
  });
});
