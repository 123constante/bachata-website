// @vitest-environment jsdom
/** Cover fix (C18 -> C18b): pick a photo, ONE series.upsert, Done "Cover added" with `next`. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ workspace: vi.fn(), run: vi.fn(), upload: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchSeriesWorkspace: api.workspace,
  runSeriesCommand: api.run,
}));
vi.mock('../../../events/media', () => ({ uploadEventPicture: api.upload }));

import CoverFlow from '../index';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { ORG_PATHS } from '../../../shell/paths';

function Where() {
  const l = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(l.state ?? null)}>{l.pathname}</p>;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ORG_PATHS.cover('s1')]}>
        <Routes>
          <Route path="/account/o/cover/:seriesId" element={<CoverFlow />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const file = () => new File(['x'], 'cover.png', { type: 'image/png' });

beforeEach(() => {
  api.workspace.mockReset().mockResolvedValue({ series: { version: 7, default_cover_image_url: null } });
  api.run.mockReset().mockResolvedValue({ new_version: 8 });
  api.upload.mockReset().mockResolvedValue('https://cdn.example/c.jpg');
});
afterEach(cleanup);

describe('cover fix', () => {
  it('sends exactly ONE command (upsert of the cover url) and lands on Done with next = the event', async () => {
    mount();
    fireEvent.change(await screen.findByTestId('cover-input'), { target: { files: [file()] } });
    const where = await screen.findByTestId('where');
    expect(api.run).toHaveBeenCalledTimes(1);
    const sent = api.run.mock.calls[0][0];
    expect(sent.target_id).toBe('s1');
    expect(sent.expected_version).toBe(7);
    expect(JSON.stringify(sent.command)).toContain('https://cdn.example/c.jpg');
    expect(sent.command.kind).toBe('series.upsert');
    expect(sent.command.payload).toEqual({ default_cover_image_url: 'https://cdn.example/c.jpg' });
    expect(where.textContent).toBe(ORG_PATHS.done);
    expect(JSON.parse(where.getAttribute('data-state')!)).toMatchObject({ message: 'Cover added', next: ORG_PATHS.event('s1'), nextLabel: 'Back to the event' });
  });

  it('a refused upload sends nothing and says why', async () => {
    api.upload.mockRejectedValue(new Error('That photo is too big.'));
    mount();
    fireEvent.change(await screen.findByTestId('cover-input'), { target: { files: [file()] } });
    expect((await screen.findByTestId('cover-error')).textContent).toBe('That photo is too big.');
    expect(api.run).not.toHaveBeenCalled();
  });

  it('the version sent is read fresh at send time, not the one the screen loaded with', async () => {
    api.workspace.mockReset()
      .mockResolvedValueOnce({ series: { version: 7, default_cover_image_url: null } })
      .mockResolvedValue({ series: { version: 9, default_cover_image_url: null } });
    mount();
    fireEvent.change(await screen.findByTestId('cover-input'), { target: { files: [file()] } });
    await screen.findByTestId('where');
    expect(api.run.mock.calls[0][0].expected_version).toBe(9);
  });

  // SH-5: the server replays a stored answer for (actor, key) without comparing the payload.
  it.each([
    { row: 'the SAME photo again reuses the key', second: 'https://cdn.example/c.jpg', sameKey: true },
    { row: 'a DIFFERENT photo gets a new key', second: 'https://cdn.example/other.jpg', sameKey: false },
  ])('a retry after a lost answer: $row', async ({ second, sameKey }) => {
    api.run.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    api.upload.mockResolvedValueOnce('https://cdn.example/c.jpg').mockResolvedValueOnce(second);
    mount();
    const input = await screen.findByTestId('cover-input');
    fireEvent.change(input, { target: { files: [file()] } });
    const error = await screen.findByTestId('cover-error');
    // N-8: plain copy, never the raw fetch message.
    expect(error.textContent).not.toMatch(/Failed to fetch/);
    expect(error.textContent).toBe(commandErrorMessage(new TypeError('Failed to fetch')));
    fireEvent.change(await screen.findByTestId('cover-input'), { target: { files: [file()] } });
    await screen.findByTestId('where');
    expect(api.run).toHaveBeenCalledTimes(2);
    const [a, b] = api.run.mock.calls.map(([env]) => env as { idempotency_key: string; command: { payload: unknown } });
    expect(b.command.payload).toEqual({ default_cover_image_url: second });
    expect(a.idempotency_key === b.idempotency_key).toBe(sameKey);
  });

  it('the picker is a 44px+ control', async () => {
    mount();
    expect((await screen.findByTestId('cover-label')).className).toMatch(/min-h-\[(4[4-9]|5\d)px\]/);
  });
});
