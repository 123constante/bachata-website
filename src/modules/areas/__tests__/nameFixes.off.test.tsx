// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DancersSeeLine } from '../shared/DancersSeeLine';
import { NAME_BOX_WIDE_PX } from '@/modules/event-page/bento/blocks/schedule/PersonChip';

it('flag off: nothing rendered', () => {
  const { container } = render(<DancersSeeLine details={{ display_name: 'A' }} typedDjName="B" />);
  expect(container.innerHTML).toBe('');
});
it('wide box is 96px', () => expect(NAME_BOX_WIDE_PX).toBe(96));
