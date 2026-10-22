import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEmbeddedProfile } from '@/lib/embeddedProfile';
import { flags } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { usePeopleBadges } from './badges';
import type { PersonRole } from './personRoles';
import { BAR_BACKGROUND, BAR_FADE, roleSwitchModel, TAP, type RoleSwitch } from './roleSwitch';
import { usePersonSnapshot } from './usePersonRoles';
import { CHIP, FOCUS_RING, WALL } from './wall/tokens';

/** The pure bar: "Back to <name>" (44px, ellipsis) and, with 2+ role pages, one pill per page. */
export function RoleSwitchView({ model, className, fade = true }: { model: RoleSwitch; className?: string; fade?: boolean }) {
  return (
    <div
      data-testid="role-switch"
      className={cn('flex flex-col gap-2', className)}
      style={fade ? { background: BAR_BACKGROUND, paddingTop: BAR_FADE.top, paddingBottom: BAR_FADE.bottom } : undefined}
    >
      <Link
        to={model.back.href}
        data-testid="role-switch-back"
        className={cn('inline-flex min-w-0 max-w-full items-center gap-2 self-start px-1 text-[15px] font-bold', FOCUS_RING)}
        style={{ minHeight: TAP, color: WALL.text }}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{model.back.label}</span>
      </Link>
      {model.pills.length > 0 ? (
        <nav
          aria-label="Roles"
          className="flex w-full items-stretch gap-1 rounded-full p-1"
          style={{ background: WALL.card, border: `1px solid ${WALL.line}` }}
        >
          {model.pills.map((p) => (
            <Link
              key={p.role}
              to={p.href}
              data-testid="role-pill"
              data-role={p.role}
              aria-current={p.current ? 'page' : undefined}
              className={cn('flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-[15px] font-bold', FOCUS_RING)}
              style={{
                minHeight: TAP,
                ...(p.current ? { background: CHIP[p.role].bg, color: CHIP[p.role].text } : { color: WALL.text }),
              }}
            >
              {p.current ? null : (
                <span aria-hidden data-testid="role-dot" className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: CHIP[p.role].bg }} />
              )}
              <span className="truncate">{p.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

/**
 * The bar on a role page (flags.personHub ON). Nothing in a /people/:id tab, and nothing until both
 * the badges read (roles) and the person read (name) have answered, so SSR and the first client render
 * match and the bar never shows a placeholder name. `fallback` shows meanwhile (so the DJ page's
 * "Back to DJs" becomes the bar once the reads answer), and when there is no hub to go back to.
 */
export function RoleSwitch({ current, id, slug, className, fade, fallback = null }: {
  current: PersonRole;
  id: string | undefined;
  slug?: string | null;
  className?: string;
  fade?: boolean;
  fallback?: ReactNode;
}) {
  const embedded = useEmbeddedProfile();
  const { badges } = usePeopleBadges(embedded || !id ? [] : [id]);
  const person = usePersonSnapshot(embedded ? undefined : id);
  // No snapshot (or no visible role) = /people/:id would 404: never a Back link into it.
  if (embedded || !id || !person.answered || !person.snapshot?.roles.length) return <>{fallback}</>;
  const model = roleSwitchModel({
    badge: badges.get(id),
    current,
    slugOrId: slug ?? id,
    name: person.snapshot?.name,
    teacherPagesOpen: flags.teacherDetail,
  });
  return model ? <RoleSwitchView model={model} className={className} fade={fade} /> : <>{fallback}</>;
}
