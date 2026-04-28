import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Three tile modes drive both visual and interaction behaviour after the
// Phase 8g strong-button migration:
//
//   tappable     — full button shell: brass-tinted border, two-layer
//                  shadow (inner top highlight + drop shadow), scale-to-98%
//                  press animation, 10% inner darkening overlay, cursor
//                  pointer. Single tap target. Rendered as <button> (or
//                  <Link> if href is provided). This is the default when
//                  onClick or href is set.
//   container    — suppressed shell: softer neutral border, no inner
//                  highlight, no press state. Used by Schedule so only
//                  the inner person avatars are tap targets and the tile
//                  visually reads as a list container, not a button.
//   multi-target — button shell (border + shadow) but rendered as a
//                  <div>, not a button, with no press state on the outer
//                  surface. Inner buttons handle their own taps. Used by
//                  Guest + Contacts, whose tiles contain multiple
//                  independent tap targets.
export type BentoTileMode = 'tappable' | 'container' | 'multi-target';

type BentoTileProps = {
  // Title can be omitted (empty string) to hide the brass label strip
  // entirely — used by tiles whose content is self-explanatory (date, city,
  // venue) per Ricky's 2026-04-28 cleanup.
  title: string;
  color: string;
  children?: ReactNode;
  className?: string;
  mode?: BentoTileMode;
  onClick?: () => void;
  href?: string;
};

const SHELL_BASE =
  'relative flex h-full w-full flex-col overflow-hidden rounded-[22px] text-left';

// Strong-button visual: brass-at-18% border + two-layer shadow. Shared
// by tappable and multi-target; omitted for container.
const BUTTON_VISUAL_CLASS =
  'border border-[color:var(--bento-hairline)] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_8px_16px_rgba(0,0,0,0.45)]';

const CONTAINER_VISUAL_CLASS =
  'border border-white/[0.06] shadow-[0_6px_14px_rgba(0,0,0,0.35)]';

// Tappable interaction layer — only added when the tile itself is a tap
// target. The ::after pseudo handles the 10% inner darkening flash.
const TAPPABLE_INTERACTION_CLASS =
  'cursor-pointer transition-transform duration-150 ease-out active:scale-[0.98] ' +
  'after:pointer-events-none after:absolute after:inset-0 after:rounded-[22px] ' +
  'after:bg-black/10 after:opacity-0 after:transition-opacity after:duration-150 ' +
  'after:content-[""] active:after:opacity-100 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

// Compact density — Phase 8g sizing. Title strip drops to 10 px with a
// 2 px bottom trail, content pulls in to px-2.5 / pb-2.5.
const TITLE_STRIP_CLASS =
  'px-2.5 pb-[2px] pt-2 text-[10px] font-bold uppercase tracking-[0.04em]';
// Default content wrapper has no top padding because the title strip
// provides it. When the title strip is omitted (empty title), we add
// pt-2.5 so content keeps a comfortable distance from the tile edge.
const CONTENT_WRAPPER_CLASS = 'flex min-h-0 flex-1 flex-col px-2.5 pb-2.5';
const CONTENT_WRAPPER_NO_TITLE_CLASS = `${CONTENT_WRAPPER_CLASS} pt-2.5`;

export const BentoTile = ({
  title,
  color,
  children,
  className,
  mode,
  onClick,
  href,
}: BentoTileProps) => {
  // mode resolution: explicit prop wins; otherwise infer from handlers.
  // A tile with no onClick/href and no mode falls back to 'container' —
  // historically such tiles rendered inert <div> anyway.
  const resolvedMode: BentoTileMode =
    mode ?? (onClick || href ? 'tappable' : 'container');
  const isTappable = resolvedMode === 'tappable';
  const usesButtonVisual = resolvedMode !== 'container';

  const shellClass = [
    SHELL_BASE,
    usesButtonVisual ? BUTTON_VISUAL_CLASS : CONTAINER_VISUAL_CLASS,
    isTappable ? TAPPABLE_INTERACTION_CLASS : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const shellStyle = {
    background: color,
    color: 'hsl(var(--bento-fg))',
  } as const;

  const titleStyle = { color: 'hsl(var(--bento-accent))' } as const;
  const hasTitle = Boolean(title);

  const inner = (
    <>
      {hasTitle && (
        <div className={TITLE_STRIP_CLASS} style={titleStyle}>
          {title}
        </div>
      )}
      <div className={hasTitle ? CONTENT_WRAPPER_CLASS : CONTENT_WRAPPER_NO_TITLE_CLASS}>
        {children}
      </div>
    </>
  );

  if (isTappable && href) {
    return (
      <Link to={href} className={shellClass} style={shellStyle}>
        {inner}
      </Link>
    );
  }
  if (isTappable) {
    return (
      <button type="button" onClick={onClick} className={shellClass} style={shellStyle}>
        {inner}
      </button>
    );
  }
  return (
    <div className={shellClass} style={shellStyle}>
      {inner}
    </div>
  );
};
