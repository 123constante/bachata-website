# dancer-app: the folder contract for wave 2

The signed-in dancer area at `/app/*` (release 1a, PR B1a). The pinned spec is
`briefs/dancer-rebuild-INTERFACE.md` on branch `arc/briefs-dancer-rebuild`; this file
says where things live and what a screen slice may import. W1 (foundation) owns
everything here except `screens/**`.

## One rule per folder

| Folder | Owner | What it is | Wave 2 may... |
|---|---|---|---|
| `shell/` | W1 | `DancerAppShell` (header, tabs, `<Outlet/>`), `DancerAppRoutes` (AuthGuard -> gate -> shell), `routes.ts` (the ONE route table), `renderInShell` + `testAuth` (test util) | import; never edit |
| `theme/` | W1 | `dancer.css` (custom properties scoped to `[data-profile="dancer"]`), `tokens.ts` | use `var(--da-*)` and the `da-*` classes; never import the sheet again |
| `gate/` | W1 | `useDancerArea`, `RedirectIfAllowed`, `DancerAreaGate` | import `useDancerArea`; never re-implement the gate |
| `api/` | W1 | `rpc.ts` (the four wrappers), `types.ts`, `errors.ts` (`copyFor`), `delta.ts` (`diffDelta`), `fakeBackend.ts` + `fixtures.ts` (tests) | import; never call `rpcLoose` / `supabase` for these RPCs directly |
| `analytics/` | W1 | `trackDancerEvent` + the six funnel event names | call `trackDancerEvent(name, props)`; it is a no-op when signed out |
| `screens/onboarding/` | W2a | `/app/welcome` | own it |
| `screens/home/`, `screens/nights/` | W2b | `/app/home`, `/app/nights` | own them |
| `screens/me/`, `screens/edit/` | W2c | `/app/me`, `/app/me/edit` | own them |
| `screens/photo/` | W2d | `/app/me/photo` | own it |
| `screens/options/` | W2e | `/app/options` | own it |

Each screen folder holds one placeholder today (`<Name>Screen.tsx`, default export,
rendering `PlaceholderScreen`). Replace the body; keep the file name and the default
export, because `shell/DancerAppRoutes.tsx` imports it by that path. A screen may add
any files inside its own folder. A screen never imports from another screen's folder;
something two screens need goes to W1's folders through the orchestrator.

## What to import from where

```ts
// data (typed, errors already mapped to copy)
import { fetchMyDancerEdit, saveMyDancerProfile, fetchPublicExtras } from '@/modules/dancer-app/api/rpc';
import type { MyDancerEdit, DancerDelta, DancerErrorCode } from '@/modules/dancer-app/api/types';
import { DancerApiError, copyFor } from '@/modules/dancer-app/api/errors';
import { diffDelta, isEmptyDelta } from '@/modules/dancer-app/api/delta';

// gate (signed-out: no request; error: closed)
import { useDancerArea } from '@/modules/dancer-app/gate/useDancerArea';

// routes and tabs (never hard-code '/app/...' strings)
import { DANCER_HOME, DANCER_WELCOME, DANCER_ROUTES } from '@/modules/dancer-app/shell/routes';

// funnel events
import { trackDancerEvent } from '@/modules/dancer-app/analytics/events';
```

Reuse from the main site (plan section 4.3), never copy: `ProfileGateContext`
(`@/hooks/useAuth`), `HideSurnameSwitch`, `CityPicker`, `uploadToR2` + `validateImageFile`,
`accountSettings.signOut`, `useSeriesLevelRating` + `levelRatingModel` + `pendingLevelRating`,
the attendance reads (`get_my_event_attendance_v2`).

## Rules a screen must keep (owner's definition of done)

- **Saves are diff-first.** Keep a draft, send `diffDelta(current, draft)`. An untouched
  form sends nothing (`saveMyDancerProfile({}, current)` returns `current` without a
  request) and its Save control is disabled with a visible reason.
- **One mapping per fact.** Error copy comes from `copyFor(code)` / `DancerApiError.message`
  only; put it under the field `DancerApiError.field` names (null = screen level).
  Strength comes from `profile.strength` (the server computes it); never recompute.
- **No copy points at a control that is not on screen.** Every empty state says what the
  person can do.
- **WhatsApp** fields render only when `profile.other_roles.length > 0`.
- **Sizes in px, not rem** (the site's phone `html` font size is ~13.5px). Tap targets
  >= 44px (`.da-tap` gives that).
- **HTML entities** (`&rsquo;`, `&mdash;`, `&hellip;`) in JSX, never raw Unicode punctuation.
- **Density**: compact (`.claude/rules/design-density.md`); the bold gradient cards use
  `--da-gradient-from` / `--da-gradient-to` with `--da-on-gradient` text.

## Testing a screen

```ts
// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_SHAPE_NAMES } from '@/modules/dancer-app/api/fixtures';

afterEach(() => { cleanup(); resetShell(); });

it.each(DANCER_SHAPE_NAMES)('edit screen x %s', async (shape) => {
  const { backend } = renderInShell({ path: '/app/me/edit', backend: { shape } });
  // ... assert on screen; backend.calls / backend.writes show what was sent
});
```

- `renderInShell` options: `path`, `auth` (`'signed-out'` or a user), `backend` (a
  `createFakeBackend(...)` or its options: `gate`, `shape`, `profile`, `rateLimit`),
  `profileGate` (what `ProfileGateContext` says), `organisers` / `openRequests`.
- `createFakeBackend` mirrors the server: gate first (`area_closed`), then session,
  persona, `unknown_key`, diff (an empty delta = no write, `writes` stays 0), rate check,
  validation (same codes, same order). `failNextWith(code)` makes the next call fail once.
- `DANCER_SHAPES` holds every production shape from the plan's section-3 survey; a
  screen test is table-driven over all of them.
- The Playwright pattern is `tests/e2e/dancer-app/reachability.spec.ts` (the gate is
  mocked with `page.route` on the RPC URL); add a new spec to `package.json` `test:e2e`
  BY NAME or it does not gate.
