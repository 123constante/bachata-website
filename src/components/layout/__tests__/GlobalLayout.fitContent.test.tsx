// @vitest-environment jsdom
// People arc S3b (D13): the people worlds opt out of the layout's full-screen min height so the
// footer comes straight after a short page. Every other page keeps min-h-screen (the default).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalLayout from '../GlobalLayout';

afterEach(cleanup);

const root = (props: Record<string, unknown>) =>
  render(
    <MemoryRouter>
      <GlobalLayout showSubheader={false} {...props}>
        <p>content</p>
      </GlobalLayout>
    </MemoryRouter>,
  ).container.firstElementChild as HTMLElement;

describe('GlobalLayout fitContent', () => {
  it('default: the page is at least one screen tall', () => {
    expect(root({}).className).toContain('min-h-screen');
  });
  it('fitContent: no min height, the footer follows the content', () => {
    const el = root({ fitContent: true, gradientPalette: 'dj' });
    expect(el.className).not.toContain('min-h-screen');
    expect(el.className).toContain('overflow-x-clip');
    // The route wrapper's min height (.route-shell) lets go of this page only.
    expect(el.getAttribute('data-fit-content')).toBe('true');
    expect(el.querySelector('style')?.textContent).toBe('.route-shell:has(> [data-fit-content]){min-height:0}');
  });
  it('default: no release of the route wrapper', () => {
    const el = root({});
    expect(el.hasAttribute('data-fit-content')).toBe(false);
    expect(el.querySelector('style')).toBeNull();
  });
});
