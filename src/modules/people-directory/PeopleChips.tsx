// People & places chip row (site structure S4a). One shared row across the directory lists so they read
// as one directory. Behind flags.peopleChips; OFF renders nothing. Heights are px (phone root font ~13.5px).

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';
import { focusRing } from '@/modules/home-map/cards/controls';

const chipBase =
  "relative inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-bold transition-colors before:absolute before:inset-x-0 before:-inset-y-[6px] before:content-['']";

export interface PeopleChipRow {
  id: string;
  label: string;
  href: string;
  selected: boolean;
}

export function peopleChipRows(
  pathname: string,
  open: { teachers: boolean; organisers: boolean },
): PeopleChipRow[] {
  const cityTeachers = /^\/city\/[^/]+\/teachers\/?$/.test(pathname);
  const cityVenues = /^\/city\/[^/]+\/venues\/?$/.test(pathname);
  const defs: Array<{ id: string; label: string; href: string; show: boolean; alt?: boolean }> = [
    { id: 'all', label: 'All', href: '/all-profiles', show: true },
    { id: 'dancers', label: 'Dancers', href: '/dancers', show: true },
    { id: 'djs', label: 'DJs', href: '/djs', show: true },
    { id: 'teachers', label: 'Teachers', href: '/teachers', show: open.teachers, alt: cityTeachers },
    { id: 'organisers', label: 'Organisers', href: '/organisers', show: open.organisers },
    { id: 'venues', label: 'Venues', href: '/venues', show: true, alt: cityVenues },
    { id: 'vendors', label: 'Vendors', href: '/vendors', show: true },
    { id: 'video', label: 'Video', href: '/videographers', show: true },
  ];
  return defs
    .filter((d) => d.show)
    .map((d) => ({
      id: d.id,
      label: d.label,
      href: d.href,
      selected: pathname === d.href || d.alt === true,
    }));
}

export function PeopleChips() {
  const { pathname } = useLocation();
  if (!flags.peopleChips) return null;
  const rows = peopleChipRows(pathname, {
    teachers: flags.teachersDirectory,
    organisers: flags.organisersDirectory,
  });
  return (
    <nav aria-label="People and places">
      <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            to={r.href}
            aria-current={r.selected ? 'page' : undefined}
            className={cn(
              chipBase,
              focusRing,
              r.selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-foreground',
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
