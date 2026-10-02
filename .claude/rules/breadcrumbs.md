---
paths:
  - "src/**/*.tsx"
  - "src/lib/breadcrumbs/**"
---

# Breadcrumbs

*Scoped rule: loads only when work touches the paths above. Moved verbatim from
the root CLAUDE.md on 2026-10-02; still mandatory.*


Every page that uses `<GlobalLayout>` MUST pass `breadcrumbs={buildBreadcrumbs(routeId, ctx)}`
from `@/lib/breadcrumbs`. Do NOT hand-roll breadcrumb arrays.

```tsx
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

// Listing
<GlobalLayout breadcrumbs={buildBreadcrumbs('parties')}>

// Detail page
<GlobalLayout breadcrumbs={buildBreadcrumbs('dancer.detail', {
  entityName: dancer?.first_name,
  isLoading,
})}>

// Event page
<GlobalLayout breadcrumbs={buildBreadcrumbs('event.detail', {
  entityName: pageModel.identity.title,
  eventType: pageModel.identity.eventType,
  isLoading: state !== 'ready',
})}>
```

Adding a new page:
1. Add a one-line entry to `src/lib/breadcrumbs/siteIa.ts`.
2. Use `buildBreadcrumbs('newRouteId', ctx)` on the page.
3. Breadcrumb unit tests in `src/lib/breadcrumbs/__tests__/` auto-cover it.

Pages with no breadcrumb (Index, Auth, AuthCallback, Onboarding) must pass
`showSubheader={false}`.
