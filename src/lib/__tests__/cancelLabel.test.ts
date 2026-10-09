import { describe, expect, it } from 'vitest';
import { cancelledLabel, publicCancelReason } from '@/lib/cancelLabel';
import { CANCEL_REASON_SHAPES } from './cancelLabelShapes';

describe.each(CANCEL_REASON_SHAPES)('cancelLabel: $name', ({ input, shown }) => {
  it('publicCancelReason returns only a reason worth showing', () => {
    expect(publicCancelReason(input)).toBe(shown);
  });

  it("cancelledLabel reads 'Cancelled' or 'Cancelled \u00B7 reason'", () => {
    expect(cancelledLabel(input)).toBe(shown ? `Cancelled \u00B7 ${shown}` : 'Cancelled');
  });
});

it('treats undefined like null', () => {
  expect(cancelledLabel(undefined)).toBe('Cancelled');
});
