// Edit in place: what every bottom sheet shares (FieldSheet, ContactSheet).
// Inputs are 16px (no iOS zoom on focus); buttons keep a 44px tap height.
import type { CSSProperties } from 'react';

export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const CREAM = '#F6F1EA';

export const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontSize: 16, lineHeight: 1.4, padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(246,241,234,0.25)', background: 'rgba(246,241,234,0.06)', color: CREAM,
};
export const btn: CSSProperties = { minHeight: 44, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer' };

/**
 * The sheet itself: against window.visualViewport (useKeyboardInset), so it sits
 * ABOVE the phone keyboard, never taller than what is visible, scrolling inside.
 */
export const sheetFrame = (inset: number, height: number | null): CSSProperties => ({
  position: 'fixed', left: 0, right: 0, bottom: inset, zIndex: 61,
  maxHeight: height ? Math.max(160, height - 12) : '85vh', overflowY: 'auto', boxSizing: 'border-box',
  background: '#17131A', color: CREAM, borderRadius: '16px 16px 0 0', borderTop: '1px solid rgba(231,190,110,0.35)',
  padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto',
});

/** Tab and Shift+Tab stay inside the sheet. */
export function trapTab(e: { key: string; shiftKey: boolean; preventDefault: () => void }, root: HTMLElement | null): void {
  if (e.key !== 'Tab' || !root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
