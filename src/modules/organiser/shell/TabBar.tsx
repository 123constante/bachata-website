import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TABS } from './tabs';

/** Fixed-height bottom tab bar (in the shell's flex column, so it never overlaps content). */
export function TabBar() {
  return (
    <nav
      aria-label="Organiser"
      data-testid="org-tabbar"
      className="shrink-0 border-t border-[var(--line)] bg-[var(--tab)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex h-[60px] max-w-[640px] items-stretch">
        {TABS.map(({ key, label, to, Icon, end }) => (
          <li key={key} className="flex-1">
            <NavLink
              to={to}
              end={end}
              data-testid={`org-tab-${key}`}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-[4px] text-[12px] font-semibold transition-colors duration-300 ease-in-out',
                  isActive ? 'text-[var(--gold)]' : 'text-[var(--mut)]',
                )
              }
            >
              <span className="flex h-[22px] w-[22px] items-center justify-center" aria-hidden="true">
                <Icon className="h-[20px] w-[20px]" aria-hidden="true" />
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
