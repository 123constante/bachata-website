---
applyTo: "src/components/**,src/pages/**"
description: "UI implementation rules for pages/components in this repository."
---

# UI Scope Rules

- Compose UI with existing shadcn/ui primitives in `src/components/ui/*` before creating new base components.
- Use Tailwind classes backed by existing theme tokens/CSS variables (`src/index.css`, `tailwind.config.ts`); avoid introducing hard-coded color systems.
- Match existing page/component structure and naming patterns in the local area you edit.
- Keep edits minimal and task-focused; do not perform opportunistic refactors while implementing UI changes.

## Design Density (Mandatory — see `CLAUDE.md` for full rules)
- Mobile card grids: **2 columns** (never 1-column card lists). Tablet: 3. Desktop: 4+.
- Card padding: `p-3`. Card gap: `gap-3`. Body text: `text-sm`. Card titles: `text-base`.
- Buttons: `py-2 px-3` default. Vertical rhythm: `space-y-3`.
- **Calendar files are EXEMPT** from density changes — do not modify `src/components/EventCalendar.tsx` or anything in `src/components/calendar/*` for density work.
