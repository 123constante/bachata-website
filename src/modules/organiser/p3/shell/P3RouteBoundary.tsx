import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation, useParams, type Params } from 'react-router-dom';
import { chunkReloadAttempted, isStaleChunkError } from '@/lib/staleChunk';
import { reportClientErrorLazy } from '@/lib/reportClientErrorLazy';
import '../theme/p3.css';

/*
 * p3-prefix-d D2: a P3 lazy route whose chunk will not load (bad signal, a deploy mid-session that
 * lazyWithRetry's one reload did not heal) shows what happened, Try again and a way back, in P3's
 * frame. Never a blank screen. Try again reloads the page: React keeps a failed lazy import, so
 * re-rendering it would only fail again.
 *
 * A failure that is not a chunk load (a bug in the screen) says so plainly, not "check the signal".
 *
 * frame: 'own'    a screen with no P3 shell around it (door, onboarding): draws the whole frame.
 *        'pushed' a screen the You hub pushes: P3Shell gives the frame and tab bar, this the top bar.
 *        'tab'    a screen inside P3Shell's top bar and main: the card only.
 */

export type P3RouteFrame = 'own' | 'pushed' | 'tab';
export interface P3RouteBack { to: string; label: string }

interface Props { frame: P3RouteFrame; back: (p: Readonly<Params>) => P3RouteBack; children: ReactNode }

class Boundary extends Component<Props, { failed: boolean; chunk: boolean }> {
  state = { failed: false, chunk: false };
  static getDerivedStateFromError(error: unknown) { return { failed: true, chunk: isStaleChunkError(error) }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('P3 route failed:', error, info);
    // a stale chunk is healed by the one reload; report only when it still fails after it
    if (!isStaleChunkError(error) || chunkReloadAttempted()) reportClientErrorLazy(error);
  }
  render() {
    return this.state.failed ? <P3RouteError frame={this.props.frame} back={this.props.back} chunk={this.state.chunk} /> : this.props.children;
  }
}

function P3RouteError({ frame, back, chunk }: Omit<Props, 'children'> & { chunk: boolean }) {
  const b = back(useParams());
  // a back link to the screen already showing would do nothing: leave it out
  const here = useLocation().pathname === b.to;
  const backLink = here ? null : (
    <Link to={b.to} className="p3-back" data-testid="p3-route-error-back"><span aria-hidden="true">&lsaquo;</span> {b.label}</Link>
  );
  const card = (
    <div className="p3-card p3-state" role="alert" data-testid="p3-route-error">
      <strong>{chunk ? 'This screen did not load' : 'Something went wrong on this screen'}</strong>
      <p className="p3-note">{chunk ? 'Check the signal, then try again.' : 'Try again; if it happens again, go back and tell us.'} Nothing you saved is lost.</p>
      <button type="button" className="p3-btn" onClick={() => window.location.reload()} data-testid="p3-route-error-retry">Try again</button>
    </div>
  );
  if (frame === 'tab') {
    return (
      <div className="p3-stack">
        {backLink}
        {card}
      </div>
    );
  }
  const body = (
    <>
      <header className="p3-top">
        <div className="p3-top-row">{backLink}</div>
      </header>
      <main className="p3-main p3-main-pushed">{card}</main>
    </>
  );
  return frame === 'own' ? <div className="p3-theme p3-frame">{body}</div> : body;
}

/** One boundary per screen: a new address starts clean, so the way back is never stuck on the error. */
export function P3RouteBoundary(props: Props) {
  const { pathname } = useLocation();
  return <Boundary key={pathname} {...props} />;
}
