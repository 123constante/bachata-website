import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SummaryRow } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';

/**
 * Class strings for the dancer screens' LINKS and tiles. The rebuild's Card / PrimaryButton / GhostButton are a div and
 * <button>s; a router <Link> or <a> that must look the same cannot be one, so it takes the same tokens (read from the
 * Ember world the shell wraps every screen in). Asked of the rebuild: an `asChild` / `href` variant on the buttons.
 * Sizes are px, never rem: the phone html font-size is ~13.5px.
 */
const LINK_BASE = 'da-tap inline-flex w-full items-center justify-center gap-[8px] rounded-[var(--r-ctl,12px)] px-[20px] text-center font-bold no-underline';

/** The ONE cream primary per screen, as a link. 52px. */
export const LINK_PRIMARY = cn(LINK_BASE, 'min-h-[52px] bg-[var(--btn)] text-[16px] text-[var(--btnfg)]');
/** Secondary action as a link, card2 surface. 52px. */
export const LINK_GHOST = cn(LINK_BASE, 'min-h-[52px] bg-[var(--card2)] text-[16px] text-[var(--fg)]');
/** Same, 44px. */
export const LINK_GHOST_SM = cn(LINK_BASE, 'min-h-[44px] bg-[var(--card2)] text-[15px] text-[var(--fg)]');
/** A quiet accent text action ("Try again", "Edit my profile"): 44px target, underlined, accent text. */
export const TEXT_ACTION =
  'da-tap inline-flex min-h-[44px] items-center justify-start border-0 bg-transparent p-0 text-[14px] font-bold text-[var(--gold-fg,#f5865a)] underline underline-offset-2';

/** The Card block's surface, for a tile that is a <Link> (Card itself is a div). */
export const TILE_CLASS = 'block rounded-[var(--r-card,16px)] border border-[var(--line)] bg-[var(--card)] p-[14px] text-[var(--fg)] no-underline';

const ROW_CLASS = 'da-tap flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[14px] text-left text-[15px] text-[var(--fg)] no-underline transition-colors duration-300 ease-in-out active:bg-[var(--card2)]';

/**
 * A SummaryRow that navigates: same box, label and chevron as the block, but a real link (SummaryRow only renders a
 * button or a div). Put several inside a <Card> for the dividers.
 */
export function LinkRow({ to, href, label, sublabel, testId, external }: { to?: string; href?: string; label: ReactNode; sublabel?: ReactNode; testId?: string; external?: boolean }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {sublabel && <span className="block text-[13px] text-[var(--mut)]">{sublabel}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </>
  );
  return to ? (
    <Link to={to} className={ROW_CLASS} data-testid={testId}>{body}</Link>
  ) : (
    <a href={href} className={ROW_CLASS} data-testid={testId} {...(external ? { target: '_blank', rel: 'noreferrer' } : null)}>{body}</a>
  );
}

/**
 * A summary row that cannot be used right now, with its reason in plain sight BELOW the row (not inside the button), so
 * the reason is read next to the control. A disabled row opens nothing and draws no chevron.
 */
export function DisabledRow({ label, reason, testId, reasonTestId }: { label: ReactNode; reason: ReactNode; testId?: string; reasonTestId?: string }) {
  return (
    <div>
      <SummaryRow label={label} disabled onPress={() => undefined} testId={testId} />
      <p className="m-0 px-[16px] pb-[12px] text-[13px] text-[var(--mut)]" data-testid={reasonTestId}>{reason}</p>
    </div>
  );
}
