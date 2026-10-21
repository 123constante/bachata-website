import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { House } from 'lucide-react';

export type SiteHomeLinkProps = {
  /** Return false to stop the tap (the screen then asks, e.g. "Discard changes?"). Default: always leave. */
  onBeforeLeave?: () => boolean;
};

/**
 * D120: the "Bachata Calendar" brand as a link with a home icon to the landing page "/", on every /app/*
 * screen. LOCAL stand-in: slice A builds the shared SiteHomeLink; the orchestrator points this at it once
 * both land (same props). 44px tap target.
 */
export const SiteHomeLink = ({ onBeforeLeave }: SiteHomeLinkProps) => {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onBeforeLeave && !onBeforeLeave()) e.preventDefault();
  };
  return (
    <Link to="/" onClick={onClick} className="da-tap da-logo da-home-link" data-testid="site-home-link" aria-label="Bachata Calendar home">
      <span className="da-home-chip" aria-hidden="true">
        <House style={{ width: 16, height: 16 }} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Bachata Calendar</span>
    </Link>
  );
};
