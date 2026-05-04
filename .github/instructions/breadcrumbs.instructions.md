---
applyTo: "src/pages/**"
description: "Mandatory breadcrumb rules for all GlobalLayout pages."
---

# Breadcrumbs (Mandatory)

Every page that renders `<GlobalLayout>` **must** pass breadcrumbs — no exceptions.

```tsx
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

// Listing page
<GlobalLayout breadcrumbs={buildBreadcrumbs('parties')}>

// Detail page
<GlobalLayout breadcrumbs={buildBreadcrumbs('dancer.detail', {
  entityName: dancer?.name,
  isLoading,
})}>
```

## Adding a new page
1. Add a one-line entry to `src/lib/breadcrumbs/siteIa.ts` (label, path, parent, entity flag).
2. Use `buildBreadcrumbs('newRouteId', ctx)` in the page component.
3. The breadcrumb unit tests in `src/lib/breadcrumbs/__tests__/` cover it automatically.

## Pages without breadcrumbs
Index, Auth, AuthCallback, and Onboarding are the only exceptions — pass `showSubheader={false}` on those.

See `CLAUDE.md` for full examples and the Schema.org SEO behaviour.
