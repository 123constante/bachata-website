// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { formatWallClockLocalIntl } from '@/lib/time/wallClock';

const h = vi.hoisted(() => ({
  flag: { groupChatCard: false } as Record<string, boolean>,
  click: vi.fn(),
}));

vi.mock('@/lib/featureFlags', () => ({ flags: h.flag }));
vi.mock('@/lib/eventLinkClicks', () => ({ recordEventLinkClick: h.click }));

import { GroupChatBlock } from '../GroupChatBlock';

const WA = 'https://chat.whatsapp.com/abc123';
const TG = 'https://t.me/somegroup';

describe('GroupChatBlock', () => {
  beforeEach(() => {
    h.flag.groupChatCard = false;
    h.click.mockClear();
  });
  afterEach(cleanup);

  it('(a) renders nothing without a url', () => {
    h.flag.groupChatCard = true;
    const { container } = render(<GroupChatBlock url={null} eventId="e1" weekday="Friday" />);
    expect(container.firstChild).toBeNull();
  });

  it('(b) flag ON + WhatsApp renders the say-hi card', () => {
    h.flag.groupChatCard = true;
    render(<GroupChatBlock url={WA} eventId="e1" weekday="Friday" />);
    expect(screen.getByText('Who’s coming on Friday?')).toBeTruthy();
    expect(screen.getByText('Say hi in the group')).toBeTruthy();
  });

  it('(c) flag ON + Telegram keeps today’s row', () => {
    h.flag.groupChatCard = true;
    render(<GroupChatBlock url={TG} eventId="e1" weekday="Friday" />);
    expect(screen.getByText('Join the group chat')).toBeTruthy();
    expect(screen.queryByText('Say hi in the group')).toBeNull();
  });

  it('(d) clicking the card records the link click as today', () => {
    h.flag.groupChatCard = true;
    render(<GroupChatBlock url={WA} eventId="e1" weekday="Friday" />);
    const a = screen.getByRole('link');
    expect(a.getAttribute('href')).toBe(WA);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('aria-label')).toBe('Join the group chat on WhatsApp (opens in a new tab)');
    fireEvent.click(a);
    expect(h.click).toHaveBeenCalledWith({
      eventId: 'e1', linkType: 'whatsapp', targetUrl: WA, source: 'bento_group_chat',
    });
  });

  it('(e) flag ON + no weekday renders "Who’s coming?"', () => {
    h.flag.groupChatCard = true;
    render(<GroupChatBlock url={WA} eventId="e1" weekday={null} />);
    expect(screen.getByText('Who’s coming?')).toBeTruthy();
    expect(screen.queryByText(/coming on/)).toBeNull();
  });

  it('(f) flag OFF + WhatsApp renders today’s row', () => {
    render(<GroupChatBlock url={WA} eventId="e1" weekday="Friday" />);
    expect(screen.getByText('Join the group chat')).toBeTruthy();
    expect(screen.queryByText('Say hi in the group')).toBeNull();
  });

  it('(g) bubbles are decoration (aria-hidden) and the pill is 44px tall', () => {
    h.flag.groupChatCard = true;
    render(<GroupChatBlock url={WA} eventId="e1" weekday="Friday" />);
    expect(screen.getByText('Who’s coming on Friday?').closest('[aria-hidden="true"]')).not.toBeNull();
    expect((screen.getByText('Say hi in the group').closest('span') as HTMLElement).className).toContain('min-h-[44px]');
  });

  it('(h) a Friday-night London wall clock reads "Friday" in any machine zone', () => {
    // startsAt is a London wall clock stamped +00; the weekday must come from the
    // stamped components, never from a machine-local getDay().
    expect(formatWallClockLocalIntl('2026-12-04T23:30:00+00:00' as never, { weekday: 'long' })).toBe('Friday');
  });
});
