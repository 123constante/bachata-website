// @vitest-environment jsdom
/**
 * Review #789 S5: with `interactive-widget=resizes-content` Android shrinks the layout viewport, so
 * the overlay inset PreviewBar reads stays about 0 and its own `typing` never turns on. The preview
 * card and the live note must also carry `data-keyboard-hide`, which keyboardSafe's <html> flag
 * hides on BOTH keyboards (index.css). Only the button stays.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LIVE_NOTE, PreviewBar } from '@/modules/organiser/ui/PreviewBar';

afterEach(cleanup);

describe('PreviewBar under an Android (resize) keyboard', () => {
  it('the preview card and the live note opt in to keyboard hiding; the button does not', () => {
    render(<PreviewBar preview={<p>card</p>} actionLabel="Save" onAction={() => {}} />);
    expect(screen.getByTestId('org-preview-bar-preview').hasAttribute('data-keyboard-hide')).toBe(true);
    expect(screen.getByText(LIVE_NOTE).hasAttribute('data-keyboard-hide')).toBe(true);
    expect(screen.getByTestId('org-preview-bar-action').closest('[data-keyboard-hide]')).toBeNull();
  });
});
