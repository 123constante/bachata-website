import { Card } from '@/modules/organiser/ui';
import { DANCER_ROUTES, type DancerRouteId } from './routes';

/**
 * W1 stand-in for a wave-2 screen: names the route inside the shell so every
 * route is reachable and testable before its real screen lands. Wave 2 deletes
 * its folder's use of this and renders the real screen.
 */
export const PlaceholderScreen = ({ id }: { id: DancerRouteId }) => {
  const route = DANCER_ROUTES.find((r) => r.id === id);
  return (
    <Card variant="padded" testId={`dancer-screen-${id}`}>
      <h1 className="m-0 text-[18px] font-extrabold">{route?.title ?? id}</h1>
      <p className="mt-[4px] text-[14px] text-[var(--mut)]">
        Coming soon.
      </p>
    </Card>
  );
};
