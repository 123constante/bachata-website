import { OrganiserShell } from './OrganiserShell';
import { ORG_PATHS } from './paths';

/**
 * Stand-in for an R1 route group whose slice has not landed yet (S1-S9). The
 * slices swap the lazy import target in OrganiserRoutes.tsx; this file stays.
 */
export default function RoutePlaceholder({ name }: { name: string }) {
  return (
    <OrganiserShell title={name} back={{ to: ORG_PATHS.home, label: 'Home' }}>
      <p data-testid="org-placeholder" data-route={name} className="text-[14px] text-[var(--mut)]">
        {name}
      </p>
    </OrganiserShell>
  );
}
