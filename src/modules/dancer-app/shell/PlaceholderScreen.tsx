import { DANCER_ROUTES, type DancerRouteId } from './routes';

/**
 * W1 stand-in for a wave-2 screen: names the route inside the shell so every
 * route is reachable and testable before its real screen lands. Wave 2 deletes
 * its folder's use of this and renders the real screen.
 */
export const PlaceholderScreen = ({ id }: { id: DancerRouteId }) => {
  const route = DANCER_ROUTES.find((r) => r.id === id);
  return (
    <section className="da-card" data-testid={`dancer-screen-${id}`}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{route?.title ?? id}</h1>
      <p className="da-muted" style={{ fontSize: 14, marginTop: 4 }}>
        Coming soon.
      </p>
    </section>
  );
};
