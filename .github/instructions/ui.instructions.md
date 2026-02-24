---
applyTo: "src/components/**,src/pages/**"
description: "UI implementation rules for pages/components in this repository."
---

# UI Scope Rules

- Compose UI with existing shadcn/ui primitives in `src/components/ui/*` before creating new base components.
- Use Tailwind classes backed by existing theme tokens/CSS variables (`src/index.css`, `tailwind.config.ts`); avoid introducing hard-coded color systems.
- Match existing page/component structure and naming patterns in the local area you edit.
- Keep edits minimal and task-focused; do not perform opportunistic refactors while implementing UI changes.
