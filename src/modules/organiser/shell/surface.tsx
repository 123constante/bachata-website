import { createContext, useContext, type ComponentType } from 'react';
import { OrganiserShell, type OrganiserShellProps } from './OrganiserShell';
import { ORG_PATHS } from './paths';

type Paths = typeof ORG_PATHS;
/** ORG_PATHS' shape with any string allowed, so another area can point the same links at its own routes. */
export type OrgPaths = { [K in keyof Paths]: Paths[K] extends string ? string : Paths[K] };

/**
 * Where the Team, Switch, Organiser page and Welcome screens are mounted. R1 is the default, so
 * nothing changes for /account/o; the P3 area (p3/you) provides its own frame and routes, and the
 * screens keep their reads, writes, strings and tests (P3 W4a: a re-skin, not a rebuild).
 */
export interface OrgSurface {
  kind: 'r1' | 'p3';
  /** The frame: title, back link, one top-bar action, the page. */
  Shell: ComponentType<OrganiserShellProps>;
  paths: OrgPaths;
  /** Where Team, Switch and the page go back to, and where Switch lands: R1 Home, P3 You. */
  hub: { to: string; label: string };
  /** Hand over's way back: R1 More (where it is opened), P3 Team. */
  handoverBack: { to: string; label: string };
  /** Add a page: Home's add sheet in R1, P3's own Welcome / Add a page (W4b). */
  addPage: string;
  /** Done's way back after a team change; null keeps Done's own "Back to Home". */
  doneBack: string | null;
  /** The same for a page save (Done "Saved"). */
  pageDoneBack: string | null;
  /** New event's way out (its first step's back, "Save as draft and leave"): R1 Home, P3 Events. */
  createHub: { to: string; label: string };
  /** The More screen's title: R1 "More", P3 "Account" (the You row that opens it). */
  moreTitle: string;
}

export const R1_SURFACE: OrgSurface = {
  kind: 'r1',
  Shell: OrganiserShell,
  paths: ORG_PATHS,
  hub: { to: ORG_PATHS.home, label: 'Home' },
  handoverBack: { to: ORG_PATHS.more, label: 'More' },
  addPage: `${ORG_PATHS.home}?add=1`,
  doneBack: null,
  pageDoneBack: null,
  createHub: { to: ORG_PATHS.home, label: 'Home' },
  moreTitle: 'More',
};

const OrgSurfaceContext = createContext<OrgSurface>(R1_SURFACE);
export const OrgSurfaceProvider = OrgSurfaceContext.Provider;
export const useOrgSurface = (): OrgSurface => useContext(OrgSurfaceContext);
