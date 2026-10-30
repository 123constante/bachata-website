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
 * frame: 'own'    a screen with no P3 shell around it (door, onboarding): draws the whole frame.
 *        'pushed' a screen the You hub pushes: P3Shell gives the frame and tab bar, this the top bar.
 *        'tab'    a screen inside P3Shell's top bar and main: the card only.
 */

export type P3RouteFrame = 'own' | 'pushed' | 'tab';
export interface P3RouteBack { to: string; label: string }

interface Props { frame: P3RouteFrame; back: (p: Readonly<Params>) => P3RouteBack; children: ReactNode }

class Boundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('P3 route failed:', error, info);
    // a stale chunk is healed by the one reload; report only when it still fails after it
    if (!isStaleChunkError(error) || chunkReloadAttempted()) reportClientErrorLazy(error);
  }
  render() {
    return this.state.failed ? <P3RouteError frame={this.props.frame} back={this.props.back} /> : this.props.children;
  }
}

function P3RouteError({ frame, back }: Omit<Props, 'children'>) {
  const b = back(useParams());
  const card = (
    <div className="p3-card p3-state" role="alert" data-testid="p3-route-error">
      <strong>This screen did not load</strong>
      <p className="p3-note">Check the signal, then try again. Nothing you saved is lost.</p>
      <button type="button" className="p3-btn" onClick={() => window.location.reload()} data-testid="p3-route-error-retry">Try again</button>
    </div>
  );
  if (frame === 'tab') {
    return (
      <div className="p3-stack">
        <Link to={b.to} className="p3-back" data-testid="p3-route-error-back"><span aria-hidden="true">&lsaquo;</span> {b.label}</Link>
        {card}
      </div>
    );
  }
  const body = (
    <>
      <header className="p3-top">
        <div className="p3-top-row">
          <Link to={b.to} className="p3-back" data-testid="p3-route-error-back"><span aria-hidden="true">&lsaquo;</span> {b.label}</Link>
        </div>
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
