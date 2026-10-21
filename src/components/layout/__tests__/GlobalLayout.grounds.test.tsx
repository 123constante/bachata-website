// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalLayout from '../GlobalLayout';
import { PAGE_GROUNDS } from '../pageGrounds';

const mount = (props: Record<string, unknown>) =>
  render(
    <MemoryRouter>
      <GlobalLayout showSubheader={false} {...props}>
        <p>content</p>
      </GlobalLayout>
    </MemoryRouter>,
  );

// Floating icons live in a fixed wrapper; the animated wash is a motion.div
// carrying an inline 200% backgroundSize.
const iconWrapper = (c: HTMLElement) => c.querySelector('div.fixed.overflow-hidden');
const animatedWash = (c: HTMLElement) => c.querySelector('div[style*="200%"]');

afterEach(() => {
  cleanup();
  document.body.style.background = '';
  document.documentElement.style.background = '';
});

describe('GlobalLayout grounds', () => {
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };

  it.each([
    ['default', '#0e1215'],
    ['dancer', '#06191F'],
    ['dj', '#0A080B'],
  ] as const)('%s: static ground, no icons, body painted', (palette, base) => {
    expect(PAGE_GROUNDS[palette].base).toBe(base);
    const { container } = mount({ gradientPalette: palette, floatingCount: 20 });
    expect(iconWrapper(container)).toBeNull();
    expect(animatedWash(container)).toBeNull();
    expect(container.querySelector('[data-testid="page-ground"]')).not.toBeNull();
    expect(document.body.style.backgroundColor).toBe(rgb(base));
    expect(document.documentElement.style.backgroundColor).toBe(rgb(base));
  });

  it('restores the document background on unmount', () => {
    document.body.style.background = 'rgb(1, 2, 3)';
    const { unmount } = mount({});
    unmount();
    expect(document.body.style.backgroundColor).toBe('rgb(1, 2, 3)');
  });

  it.each(['bento'] as const)('%s keeps its animated wash and icons', (palette) => {
    const { container } = mount({ gradientPalette: palette });
    expect(animatedWash(container)).not.toBeNull();
    expect(iconWrapper(container)).not.toBeNull();
    expect(document.body.style.background).toBe('');
  });

  it.each(['velvet', 'brass', 'organiser'] as const)('%s: own static wash, no icons, body untouched', (palette) => {
    const { container } = mount({ gradientPalette: palette });
    expect(container.querySelector('[data-testid="page-ground"]')).toBeNull();
    expect(iconWrapper(container)).toBeNull();
    expect(animatedWash(container)).toBeNull();
    expect(document.body.style.background).toBe('');
  });

  it('showGradientBg=false renders no ground and leaves the body alone', () => {
    const { container } = mount({ showGradientBg: false });
    expect(container.querySelector('div.fixed.-z-10')).toBeNull();
    expect(iconWrapper(container)).toBeNull();
    expect(document.body.style.background).toBe('');
  });
});
