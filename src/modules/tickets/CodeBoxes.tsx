import type { MutableRefObject } from 'react';
import { CODE_LENGTH } from './pickerModel';

/** The checkout picker's look; other hosts pass their own (e.g. the dark dancer sheet). */
export const CODE_BOX_COLORS = { ink: '#17211c', line: '#e3e9e6', bad: '#b3261e', bg: '#fff' } as const;
export type CodeBoxColors = { ink: string; line: string; bad: string; bg: string };

export const emptyDigits = (): string[] => Array(CODE_LENGTH).fill('');

/**
 * The 6-box code entry, extracted from the B1 checkout picker so the account-link sheet
 * reuses the SAME behaviour: one digit per box, focus moves on, Backspace steps back,
 * paste / one-time-code autofill fills every box, and the 6th digit calls onComplete.
 * The host owns the digits, the error and the shake (it decides what "wrong" means).
 */
export function CodeBoxes({ digits, onDigits, onComplete, busy, bad, shake, boxes, colors = CODE_BOX_COLORS, testId = 'code-boxes' }: {
  digits: string[];
  onDigits(next: string[]): void;
  onComplete(code: string): void;
  busy: boolean;
  bad: boolean;
  shake: boolean;
  boxes: MutableRefObject<Array<HTMLInputElement | null>>;
  colors?: CodeBoxColors;
  testId?: string;
}) {
  function onDigit(i: number, raw: string) {
    let d = raw.replace(/\D/g, '');
    // Typing into a box that already holds a digit gives two characters: keep the new one, not a paste.
    if (d.length === 2 && digits[i]) d = d[0] === digits[i] ? d[1] : d[0];
    if (d.length > 1) { // paste or autofill
      const next = d.slice(0, CODE_LENGTH).split('');
      onDigits(Array.from({ length: CODE_LENGTH }, (_, k) => next[k] ?? ''));
      if (next.length === CODE_LENGTH) onComplete(next.join(''));
      return;
    }
    const next = digits.slice(); next[i] = d; onDigits(next);
    if (d && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) { (document.activeElement as HTMLElement | null)?.blur(); onComplete(next.join('')); }
  }
  return (
    <div data-testid={testId} data-code-boxes="" className="flex justify-between gap-2" style={shake ? { animation: 'pickerBuzz .28s' } : undefined}>
      <style>{'@keyframes pickerBuzz{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}@media (prefers-reduced-motion:reduce){[data-code-boxes]{animation:none!important}}'}</style>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { boxes.current[i] = el; }} value={d} inputMode="numeric" aria-label={`Digit ${i + 1}`} disabled={busy}
          autoComplete={i === 0 ? 'one-time-code' : 'off'} autoFocus={i === 0}
          onChange={(e) => onDigit(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus(); }}
          className="h-[54px] min-w-0 flex-1 rounded-[10px] p-0 text-center text-[22px] font-semibold" style={{ border: `1px solid ${bad ? colors.bad : colors.line}`, color: colors.ink, background: colors.bg }} />
      ))}
    </div>
  );
}
