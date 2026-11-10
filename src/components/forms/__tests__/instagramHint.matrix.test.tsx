// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InstagramInput } from '../InstagramInput';

type Row = { name: string; value: string; stored?: string | null; error?: string | null; hint: string | null; localError: boolean };

const ROWS: Row[] = [
  { name: 'untouched', value: 'old.name', stored: 'old.name', hint: null, localError: false },
  { name: '@handle', value: '@simon.bachata', hint: 'Will save as simon.bachata', localError: false },
  { name: 'bare handle', value: 'simon.bachata', hint: 'Will save as simon.bachata', localError: false },
  { name: 'pasted link', value: 'https://instagram.com/simon.bachata/', hint: 'Will save as simon.bachata', localError: false },
  { name: 'invalid', value: 'a b', hint: null, localError: true },
  { name: 'valid + server error', value: 'simon.bachata', error: 'Could not save.', hint: null, localError: false },
];

describe('instagramHint.matrix', () => {
  afterEach(cleanup);
  it.each(ROWS)('$name', (row) => {
    const { container } = render(<InstagramInput value={row.value} stored={row.stored ?? null} error={row.error ?? null} onChange={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Saved as/);
    if (row.hint) expect(text).toContain(row.hint);
    else expect(text).not.toMatch(/Will save as/);
    expect(!!screen.queryByTestId('instagram-input-error')).toBe(row.localError || !!row.error);
    expect(!!screen.queryByTestId('instagram-input-ok')).toBe(!!row.hint);
    expect(!!screen.queryByTestId('instagram-input-check')).toBe(!!row.hint);
  });
});
