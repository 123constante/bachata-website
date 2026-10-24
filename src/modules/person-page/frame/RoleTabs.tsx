import { Link } from 'react-router-dom';
import type { PersonRole } from '../personRoles';
import { TAP } from '../roleSwitch';
import { FOCUS_RING } from '../wall/tokens';
import { FRAME, ROLE_COLOUR } from '../worlds/tokens';
import { roleTabs } from './roleTabsModel';

/**
 * The role tabs: one row above the photo, the same y on every world. The current role is
 * filled in its colour, the others carry a dot in theirs; every tab is a real link and at
 * least 44px tall (explicit px: html is ~13.5px on phones). Nothing for a one-role person.
 */
export function RoleTabs({ roles, current, slug }: { roles: readonly PersonRole[]; current: PersonRole; slug: string | null | undefined }) {
  const tabs = roleTabs(roles, current, slug);
  if (!tabs) return null;
  return (
    <nav
      aria-label="Roles"
      data-testid="role-tabs"
      className="flex w-full items-stretch gap-1 rounded-full"
      style={{ padding: 3, background: FRAME.tabsTrack, border: `1px solid ${FRAME.tabsBorder}` }}
    >
      {tabs.map((t) => (
        <Link
          key={t.role}
          to={t.href}
          data-testid="role-tab"
          data-role={t.role}
          aria-current={t.current ? 'page' : undefined}
          className={`flex min-w-0 flex-1 items-center justify-center gap-[6px] rounded-full px-[10px] font-bold ${FOCUS_RING}`}
          style={{
            minHeight: TAP,
            fontSize: 14,
            ...(t.current ? { background: ROLE_COLOUR[t.role].fill, color: ROLE_COLOUR[t.role].on } : { color: FRAME.tabInk }),
          }}
        >
          {t.current ? null : (
            <span aria-hidden data-testid="role-tab-dot" className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: ROLE_COLOUR[t.role].fill }} />
          )}
          <span className="truncate">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
