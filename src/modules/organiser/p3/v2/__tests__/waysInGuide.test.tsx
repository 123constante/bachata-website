// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WaysInGuideView, defaultUntil, guideStep, type WaysInGuideProps } from '../WaysInGuide';

afterEach(cleanup);
const mk = (o: Partial<WaysInGuideProps> = {}) => {
  const f = { onDone: vi.fn(), onConnect: vi.fn(), onClose: vi.fn() };
  render(<WaysInGuideView oneOff={false} festival={false} stripe firstDate="2026-12-20" today="2026-12-01" {...f} {...o} />);
  return f;
};
const t = (id: string) => screen.getByTestId(id);
const next = () => fireEvent.click(t('wg-next'));
const fill = (id: string, v: string) => fireEvent.change(t(id), { target: { value: v } });
const dotsOn = () => screen.getAllByTestId('wg-dot').filter((d) => d.getAttribute('data-on') === 'true').length;

describe('WaysInGuide', () => {
  it('renders Q1 copy, cards and dots', () => {
    mk();
    expect(t('wg-title').textContent).toBe('How do dancers pay?');
    expect(t('wg-sub').textContent).toBe('Pick one or more.');
    expect(t('wg-online').textContent).toContain('Online, by card');
    expect(t('wg-online').textContent).toContain('Money in your account in seconds.');
    expect(t('wg-door').textContent).toBe('At the door');
    expect(t('wg-link').textContent).toBe('On my own ticket site');
    expect(t('wg-free').textContent).toContain('free');
    expect(t('wg-online').getAttribute('role')).toBe('checkbox');
    expect(screen.getAllByTestId('wg-dot')).toHaveLength(1);
    expect(t('wg-dots')).toBeTruthy();
  });
  it('Next is disabled with nothing picked', () => {
    mk();
    expect((t('wg-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(t('wg-door'));
    expect((t('wg-next') as HTMLButtonElement).disabled).toBe(false);
  });
  it('free is exclusive both ways', () => {
    mk();
    fireEvent.click(t('wg-door')); fireEvent.click(t('wg-online'));
    fireEvent.click(t('wg-free'));
    expect(t('wg-free').getAttribute('aria-checked')).toBe('true');
    expect(t('wg-door').getAttribute('aria-checked')).toBe('false');
    expect(t('wg-online').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(t('wg-link'));
    expect(t('wg-free').getAttribute('aria-checked')).toBe('false');
    expect(t('wg-link').getAttribute('aria-checked')).toBe('true');
  });
  it('door only goes straight to onDone with one dot', () => {
    const f = mk();
    fireEvent.click(t('wg-door'));
    expect(screen.getAllByTestId('wg-dot')).toHaveLength(1);
    next();
    expect(f.onDone).toHaveBeenCalledWith({ methods: ['door'] });
  });
  it('online + stripe: Q1 -> Q2 -> Q3 -> onDone with ticket and early', () => {
    const f = mk();
    fireEvent.click(t('wg-online'));
    expect(screen.getAllByTestId('wg-dot')).toHaveLength(3);
    next();
    expect(dotsOn()).toBe(2);
    expect(t('wg-title').textContent).toBe('What does a ticket cost?');
    expect(screen.getByText('Tickets for sale each night')).toBeTruthy();
    fill('wg-price', '8'); fill('wg-qty', '40');
    next();
    expect(t('wg-title').textContent).toBe('Cheaper tickets for early buyers?');
    expect(t('wg-finish').textContent).toBe('Done');
    fireEvent.click(t('wg-early-yes'));
    expect((t('wg-until') as HTMLInputElement).value).toBe('2026-12-13');
    fill('wg-early-price', '5');
    fireEvent.click(t('wg-finish'));
    expect(f.onDone).toHaveBeenCalledWith({ methods: [], ticket: { pence: 800, qty: 40 }, early: { pence: 500, until: expect.any(String) } });
  });
  it('No early price: onDone has ticket only', () => {
    const f = mk({ oneOff: true });
    fireEvent.click(t('wg-online')); next();
    expect(screen.getByText('Tickets for sale')).toBeTruthy();
    fill('wg-price', '8.50'); next();
    fireEvent.click(t('wg-early-no'));
    fireEvent.click(t('wg-finish'));
    expect(f.onDone).toHaveBeenCalledWith({ methods: [], ticket: { pence: 850, qty: 50 } });
  });
  it('online without stripe: connect screen, Connect and Later', () => {
    const f = mk({ stripe: false });
    fireEvent.click(t('wg-online')); fireEvent.click(t('wg-door'));
    expect(screen.getAllByTestId('wg-dot')).toHaveLength(2);
    next();
    expect(t('wg-title').textContent).toBe('Connect Stripe to sell online. It takes about 5 minutes.');
    fireEvent.click(t('wg-connect'));
    expect(f.onConnect).toHaveBeenCalled();
    fireEvent.click(t('wg-later'));
    expect(f.onDone).toHaveBeenCalledWith({ methods: ['door'] });
  });
  it('festival hides door and free', () => {
    mk({ festival: true });
    expect(screen.queryByTestId('wg-door')).toBeNull();
    expect(screen.queryByTestId('wg-free')).toBeNull();
    expect(t('wg-online')).toBeTruthy();
    expect(t('wg-link')).toBeTruthy();
  });
  it('validation lines', () => {
    const f = mk();
    fireEvent.click(t('wg-online')); next();
    next();
    expect(t('wg-err').textContent).toBe('Enter a price, like 8 or 8.50.');
    fill('wg-price', 'abc'); next();
    expect(t('wg-err').textContent).toBe('Enter a price, like 8 or 8.50.');
    fill('wg-price', '8'); next();
    fireEvent.click(t('wg-early-yes'));
    fill('wg-early-price', '9');
    fireEvent.click(t('wg-finish'));
    expect(t('wg-err').textContent).toBe('The early price must be lower than the normal price.');
    fill('wg-early-price', '5'); fill('wg-until', '2026-12-25');
    fireEvent.click(t('wg-finish'));
    expect(t('wg-err').textContent).toBe('Early tickets must end on or before the first date.');
    expect(f.onDone).not.toHaveBeenCalled();
  });
  it('Back keeps answers', () => {
    mk();
    fireEvent.click(t('wg-online')); next();
    fill('wg-price', '12'); next();
    fireEvent.click(t('wg-back'));
    expect((t('wg-price') as HTMLInputElement).value).toBe('12');
    fireEvent.click(t('wg-back'));
    expect(t('wg-online').getAttribute('aria-checked')).toBe('true');
  });
  it('initial prefills; close calls onClose', () => {
    const f = mk({ initial: { methods: ['door'] } });
    expect(t('wg-door').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(t('wg-close'));
    expect(f.onClose).toHaveBeenCalled();
  });
  it('keep-list: plain labels, top bar, next hint (prototype B)', () => {
    mk();
    expect(t('wg-close').textContent).toBe('Close');
    expect(screen.queryByTestId('wg-back')).toBeNull();
    expect(screen.queryByTestId('wg-next-hint')).toBeNull();
    fireEvent.click(t('wg-online'));
    expect(t('wg-next-hint').textContent).toBe('Next: the ticket price, then an early price if you want one.');
    next();
    expect(t('wg-back').textContent).toContain('Back');
    expect(screen.getByText('You can change both any time.')).toBeTruthy();
    expect(screen.getByText('Ticket price')).toBeTruthy();
    expect(screen.getByText('Tickets for sale each night')).toBeTruthy();
    expect(screen.queryByText('How many a night')).toBeNull();
    expect(screen.queryByText('\u00d7')).toBeNull();
    fill('wg-price', '8'); next();
    expect(screen.getByText('Sell the first tickets for less, until a date you pick.')).toBeTruthy();
    expect(t('wg-early-yes').textContent).toBe('Yes, an early price');
    expect(t('wg-early-no').textContent).toBe('No, one price for everyone');
    fireEvent.click(t('wg-early-yes'));
    expect(screen.getByText('Early price ends on')).toBeTruthy();
  });
  it('no next hint without Stripe (connect screen comes next)', () => {
    mk({ stripe: false });
    fireEvent.click(t('wg-online'));
    expect(screen.queryByTestId('wg-next-hint')).toBeNull();
  });
  it('guideStep and defaultUntil', () => {
    expect(guideStep({ online: true }, false, true)).toBe('q1');
    expect(guideStep({ online: true }, false, true, 'q2')).toBe('q3');
    expect(guideStep({ online: true }, false, false, 'q1')).toBe('connect');
    expect(guideStep({ online: false }, false, true, 'q1')).toBeNull();
    expect(defaultUntil('2026-12-03', '2026-12-01')).toBe('2026-12-01');
  });
});
