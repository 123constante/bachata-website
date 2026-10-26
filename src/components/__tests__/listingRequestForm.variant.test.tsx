// @vitest-environment jsdom
/**
 * ListingRequestForm payload per variant (Bristol polish): the teacher variant
 * turns an Instagram name into a URL the RPC accepts, keeps section and
 * source_url as today, and the event variant still refuses a non-URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ calls: [] as { fn: string; args: { p_payload: Record<string, unknown> } }[] }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string, args: { p_payload: Record<string, unknown> }) => {
    h.calls.push({ fn, args });
    return { data: { ok: true, id: 'x' }, error: null };
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import ListingRequestForm from '@/components/ListingRequestForm';

function fill(link: string) {
  const [name] = screen.getAllByRole('textbox');
  fireEvent.change(name, { target: { value: 'Sam' } });
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '07000000000' } });
  const linkBox = screen.getByLabelText(/Event link|Their profile or Instagram link/);
  fireEvent.change(linkBox, { target: { value: link } });
  fireEvent.click(screen.getByRole('button', { name: 'Send my details' }));
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  h.calls = [];
  window.history.replaceState(null, '', '/city/bristol-gb/teachers');
});
afterEach(cleanup);

describe('ListingRequestForm variants', () => {
  it('teacher: @name is sent as an Instagram URL; section and source_url as today', async () => {
    render(<ListingRequestForm section="teachers_directory" variant="teacher" cityName="Bristol" />);
    expect(screen.getByTestId('listing-form-heading').textContent).toBe('Know a teacher in Bristol?');
    fill('@maria.dance');
    await flush();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].fn).toBe('submit_listing_request_v1');
    expect(h.calls[0].args.p_payload).toMatchObject({
      section: 'teachers_directory',
      event_link: 'https://instagram.com/maria.dance',
      source_url: '/city/bristol-gb/teachers',
    });
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Thanks — we’ll look them up and add them.');
  });

  it('teacher: a link that cannot become a URL is refused before any RPC call', async () => {
    render(<ListingRequestForm section="teachers_directory" variant="teacher" />);
    fill('maria dance');
    await flush();
    expect(h.calls).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toBe('Use their @name or a link starting with http:// or https://');
  });

  it('event (default): unchanged -- a handle is refused, the label is "Event link"', async () => {
    render(<ListingRequestForm section="organisers_directory" />);
    expect(screen.queryByTestId('listing-form-heading')).toBeNull();
    fill('@maria');
    await flush();
    expect(h.calls).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toBe('Event link must start with http:// or https://');
  });

  it('event: a URL is sent as typed, success copy unchanged', async () => {
    render(<ListingRequestForm section="organisers_directory" />);
    fill('https://fb.me/e/1');
    await flush();
    expect(h.calls[0].args.p_payload).toMatchObject({ section: 'organisers_directory', event_link: 'https://fb.me/e/1' });
    expect((await screen.findByRole('status')).textContent).toBe('Thanks — I’ll call you soon.');
  });
});
