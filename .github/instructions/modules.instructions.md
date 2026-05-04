---
applyTo: "src/modules/**"
description: "Architecture rules for working inside src/modules/ vertical feature slices."
---

# Module Architecture

`src/modules/` holds self-contained vertical feature slices. Each module owns its own hooks, types, components, and query layer. Do not import between modules; share via `src/hooks/*`, `src/components/*`, or `src/lib/*`.

## Event-page module (`src/modules/event-page/`)

This is the primary built-out module. Key files:

| File | Purpose |
|------|---------|
| `useEventPage.ts` | Orchestrates state machine for the page |
| `useEventPageQuery.ts` | RPC fetch + caching |
| `buildEventPageModel.ts` | Transforms RPC payload → typed `EventPageModel` |
| `types.ts` | Shared types for the module |
| `bento/BentoPage.tsx` | Renders the tile grid |
| `bento/BentoTile.tsx` | Single tile wrapper |
| `bento/blocks/*.tsx` | Individual content blocks (one file per block) |

## Adding a new bento content block
1. Create `bento/blocks/YourBlock.tsx` — receives typed props from `EventPageModel`.
2. Wire it into `bento/BentoPage.tsx`.
3. Do not reach into `src/integrations/` directly — consume data from the model, not raw RPCs.

## Adding a new module
1. Create `src/modules/<feature>/` with `types.ts` and subdirs (`hooks/`, `components/`) as needed.
2. Add an RPC wrapper in `src/integrations/supabase/eventRpcs.ts` or a new file alongside it.
3. Expose only the page-level component; keep internal helpers private to the module.
