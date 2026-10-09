// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  AnnounceRegion,
  AttentionStrip,
  Card,
  Chip,
  Cover,
  DateChip,
  EmptyState,
  ErrorState,
  GhostButton,
  LIVE_NOTE,
  PersonRow,
  Pill,
  PreviewBar,
  PrimaryButton,
  SearchField,
  SectionLabel,
  SkeletonRows,
  StatusTag,
  SummaryRow,
  TitleInput,
  initials,
  londonDateParts,
  useAnnounce,
} from '../ui';

afterEach(cleanup);

describe('SummaryRow', () => {
  it('is a button that shows its value when it has onPress', () => {
    const onPress = vi.fn();
    render(<SummaryRow label="Venue" value="Salsa Soho" onPress={onPress} testId="row" />);
    const row = screen.getByTestId('row');
    expect(row.tagName).toBe('BUTTON');
    expect(screen.getByTestId('row-value').textContent).toBe('Salsa Soho');
    fireEvent.click(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('is static without onPress and inert when disabled', () => {
    const onPress = vi.fn();
    const { rerender } = render(<SummaryRow label="City" value="London" testId="row" />);
    expect(screen.getByTestId('row').tagName).toBe('DIV');
    rerender(<SummaryRow label="City" value="London" onPress={onPress} disabled testId="row" />);
    fireEvent.click(screen.getByTestId('row'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Card + SectionLabel', () => {
  it('names its region with the label', () => {
    render(<Card label="Date" testId="card"><SummaryRow label="Starts on" /></Card>);
    expect(screen.getByRole('region', { name: 'Date' })).toBeTruthy();
    render(<SectionLabel testId="sl">Next dates</SectionLabel>);
    expect(screen.getByTestId('sl').tagName).toBe('H2');
  });
});

describe('Chip', () => {
  it('toggles aria-pressed and shows a check when selected', () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Chip selected={on} onToggle={() => setOn((v) => !v)} testId="chip">Sensual</Chip>;
    }
    render(<Harness />);
    const chip = screen.getByTestId('chip');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.querySelector('svg')).toBeTruthy();
  });
});

describe('Buttons', () => {
  it('keep their label in the layout while loading, and block clicks', () => {
    const onClick = vi.fn();
    render(<PrimaryButton loading onClick={onClick} testId="b">Save changes</PrimaryButton>);
    const b = screen.getByTestId('b') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    const label = screen.getByText('Save changes');
    expect(label.className).toContain('invisible');
    expect(b.className).toContain('h-[52px]');
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('ghost small is 44px', () => {
    render(<GhostButton size="sm" testId="g">Cancel</GhostButton>);
    expect(screen.getByTestId('g').className).toContain('h-[44px]');
  });
});

describe('StatusTag / Pill', () => {
  it('maps tones', () => {
    render(<><StatusTag tone="live" testId="t1">Live</StatusTag><StatusTag tone="draft" testId="t2">Draft</StatusTag><Pill testId="p">Open level</Pill></>);
    expect(screen.getByTestId('t1').className).toContain('--ok-bg');
    expect(screen.getByTestId('t2').className).toContain('--warn-bg');
    expect(screen.getByTestId('p').textContent).toBe('Open level');
  });
});

describe('DateChip', () => {
  it('reads a bare date as a London calendar date', () => {
    expect(londonDateParts('2026-10-25')).toMatchObject({ day: '25', month: 'Oct' });
    expect(londonDateParts('2026-03-29').day).toBe('29');
    // 23:30 UTC on 31 May is already 1 June in London (BST).
    expect(londonDateParts('2026-05-31T23:30:00Z')).toMatchObject({ day: '1', month: 'Jun' });
  });
  it('gives screen readers the full date', () => {
    render(<DateChip date="2026-10-09" testId="d" />);
    expect(screen.getByTestId('d').textContent).toContain('Fri 9 October');
  });
});

describe('TitleInput', () => {
  it('turns newlines into spaces and swallows Enter', () => {
    const onChange = vi.fn();
    render(<TitleInput value="" onChange={onChange} aria-label="Event name" testId="ti" />);
    const ti = screen.getByTestId('ti');
    fireEvent.change(ti, { target: { value: 'Bachata\nNight' } });
    expect(onChange).toHaveBeenCalledWith('Bachata Night');
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    ti.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('PersonRow', () => {
  it('removes, then offers Undo on a greyed, struck-through row', () => {
    const onRemove = vi.fn();
    const onUndo = vi.fn();
    const { rerender } = render(<PersonRow name="Ana Ruiz" role="Teacher" onRemove={onRemove} testId="p" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Ruiz' }));
    expect(onRemove).toHaveBeenCalled();
    rerender(<PersonRow name="Ana Ruiz" role="Teacher" removed onUndo={onUndo} onRemove={onRemove} testId="p" />);
    expect(screen.queryByRole('button', { name: 'Remove Ana Ruiz' })).toBeNull();
    expect(screen.getByText('Ana Ruiz').className).toContain('line-through');
    fireEvent.click(screen.getByTestId('p-undo'));
    expect(onUndo).toHaveBeenCalled();
  });
  it('makes initials', () => {
    expect(initials('Cleo  Park')).toBe('CP');
    expect(initials('Ana')).toBe('A');
    expect(initials('  ')).toBe('?');
  });
});

describe('Cover / AttentionStrip / SearchField', () => {
  it('cover has a labelled change button only when changeable', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Cover alt="" testId="c" />);
    expect(screen.queryByTestId('c-change')).toBeNull();
    rerender(<Cover alt="" onChange={onChange} testId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Change cover' }));
    expect(onChange).toHaveBeenCalled();
  });
  it('strip is one button with its action word', () => {
    const onPress = vi.fn();
    render(<AttentionStrip actionLabel="Extend" onPress={onPress} testId="s">Dates listed until 4 Dec</AttentionStrip>);
    fireEvent.click(screen.getByTestId('s'));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByTestId('s').textContent).toContain('Extend');
  });
  it('search clears', () => {
    const onChange = vi.fn();
    render(<SearchField value="an" onChange={onChange} aria-label="Search teachers" testId="q" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('States, skeleton, preview bar, announce', () => {
  it('error state offers a retry; empty state renders its action', () => {
    const onRetry = vi.fn();
    render(<><ErrorState onRetry={onRetry} testId="e" /><EmptyState title="No events yet" action={<span>go</span>} testId="m" /></>);
    fireEvent.click(screen.getByTestId('e-retry'));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByTestId('m').textContent).toContain('go');
  });
  it('skeleton rows are a busy status, never a spinner', () => {
    render(<SkeletonRows count={4} label="Loading dates" testId="sk" />);
    const sk = screen.getByRole('status', { name: 'Loading dates' });
    expect(sk.querySelectorAll('.org-skeleton')).toHaveLength(4);
    expect(sk.querySelector('svg')).toBeNull();
  });
  it('preview bar shows the live note and its one action', () => {
    const onAction = vi.fn();
    render(<PreviewBar preview={<div>card</div>} actionLabel="Save changes" onAction={onAction} />);
    expect(screen.getByText(LIVE_NOTE)).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-preview-bar-action'));
    expect(onAction).toHaveBeenCalled();
  });
  it('announces, and re-announces the same text', () => {
    vi.useFakeTimers();
    let say: (t: string) => void = () => {};
    function H() {
      const [msg, announce] = useAnnounce();
      say = announce;
      return <AnnounceRegion message={msg} />;
    }
    render(<H />);
    act(() => say('Saved'));
    act(() => vi.advanceTimersByTime(60));
    expect(screen.getByTestId('org-announce').textContent).toBe('Saved');
    act(() => say('Saved'));
    expect(screen.getByTestId('org-announce').textContent).toBe('');
    act(() => vi.advanceTimersByTime(60));
    expect(screen.getByTestId('org-announce').textContent).toBe('Saved');
    vi.useRealTimers();
  });
});
