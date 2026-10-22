import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useEmbeddedProfile } from '@/lib/embeddedProfile';
import { flags } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import type { PersonRole } from '@/lib/searchEntities';
import { roleTagsFor, usePeopleBadges, type PersonBadge, type RoleTag } from './badges';

type Props = {
  /** The role page this bar sits on: that role is left out of the bar. */
  current: PersonRole;
  id: string | undefined;
  /** Kept so existing callers compile; the hrefs come from badges.ts. */
  slug?: string | null;
  /** Layout box (padding / width) for the row. Lives HERE so a null row leaves no empty box on the page. */
  className?: string;
};

const GOLD = '#E7BE6E';
const DJ_INK = '#120c14';
const TEAL_ACCENT = '#5EE0E6';
const TEAL_INK = '#06191F';

// A linked chip is filled in the colour of the page it opens; a plain tag is an outline.
const FILL: Partial<Record<PersonRole, { background: string; color: string; border: string }>> = {
  dj: { background: GOLD, color: DJ_INK, border: `1px solid ${GOLD}` },
  dancer: { background: TEAL_ACCENT, color: TEAL_INK, border: `1px solid ${TEAL_ACCENT}` },
};
const PLAIN = { border: '1px solid rgba(246,241,234,.55)', color: '#F6F1EA' } as const;
const CHIP = 'inline-flex min-w-0 items-center justify-center gap-1 rounded-full px-3 text-[14px] font-bold';

/** The pure bar: one row of equal-height (44px) chips. Null when the person has no other role. */
export function AlsoBar({ badge, current, teacherPagesOpen, className }: {
  badge: PersonBadge | undefined;
  current: PersonRole;
  teacherPagesOpen: boolean;
  className?: string;
}) {
  if (!badge) return null;
  const tags: RoleTag[] = roleTagsFor(badge, { teacherPagesOpen, withStageName: true, exclude: current });
  if (tags.length === 0) return null;
  return (
    <nav aria-label="Other roles" className={cn('flex flex-nowrap items-stretch gap-2', className)} data-testid="also-bar">
      {tags.map((t) =>
        t.href ? (
          <Link key={t.role} to={t.href} data-testid="also-chip" className={CHIP} style={{ minHeight: 44, ...FILL[t.role] }}>
            <span className="truncate">{t.label}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        ) : (
          <span key={t.role} data-testid="also-chip" className={CHIP} style={{ minHeight: 44, ...PLAIN }}>{t.label}</span>
        ),
      )}
    </nav>
  );
}

/** The Also bar on a role page. Nothing in a tab of /people/:id, and nothing until the badge read answers. */
export function AlsoRoles({ current, id, className }: Props) {
  const embedded = useEmbeddedProfile();
  const { badges } = usePeopleBadges(embedded || !id ? [] : [id]);
  if (embedded || !id) return null;
  return (
    <AlsoBar
      badge={badges.get(id)}
      current={current}
      teacherPagesOpen={flags.teacherDetail}
      className={className}
    />
  );
}
