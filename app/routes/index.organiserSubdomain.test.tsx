// @vitest-environment jsdom
/**
 * The organiser sub-address renders the organiser page through a patched route match. The framework
 * plugin's withComponentProps reads useLoaderData() by the LAST match's route id, so that match must
 * keep the index route's id (a synthetic id lost the loader data -> "Organiser not found").
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider, useLoaderData, useParams } from 'react-router';

vi.mock('./organiser', () => ({
  default: () => {
    const d = useLoaderData() as { marker?: string } | undefined;
    const p = useParams();
    return <p>{`marker ${d?.marker ?? 'missing'} id ${p.id ?? 'missing'}`}</p>;
  },
  loader: () => null,
  meta: () => [],
}));
vi.mock('./event', () => ({ default: () => null, headers: () => ({}), loader: () => null, meta: () => [] }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: vi.fn() }));
vi.mock('@/lib/seo/resolvePublicOrganiserRef', () => ({ resolvePublicOrganiserRef: vi.fn() }));

describe('OrganiserOnSubdomain', () => {
  it('keeps the index route loader data and exposes the label as :id', async () => {
    const { OrganiserOnSubdomain } = await import('./index');
    const routes = [
      {
        id: 'routes/index',
        path: '/',
        loader: () => ({ organiserLabel: 'bpmdancestudios', marker: 'ok' }),
        Component: () => <OrganiserOnSubdomain loaderData={useLoaderData() as { organiserLabel: string }} />,
      },
    ];
    const { query, dataRoutes } = createStaticHandler(routes);
    const context = await query(new Request('http://localhost/'));
    if (context instanceof Response) throw new Error('unexpected response');
    const router = createStaticRouter(dataRoutes, context);
    const html = renderToString(<StaticRouterProvider router={router} context={context} hydrate={false} />);
    expect(html).toContain('marker ok');
    expect(html).toContain('id bpmdancestudios');
  });
});
