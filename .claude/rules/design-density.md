---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "app/**/*.tsx"
---

# Design density

*Scoped rule: loads only when work touches the paths above. Moved verbatim from
the root CLAUDE.md on 2026-10-02; still mandatory.*


This project prefers COMPACT, information-dense layouts.

- Mobile (>=375px): default to **3-column grids** for card lists (venues,
  events, teachers, DJs, dancers, organisers). Never 1-column unless the
  card legitimately needs full width.
- Tablet: 3 columns. Desktop: 4+ columns.
- Card padding: p-3 (not p-4/p-6). Gap between cards: gap-3 (not gap-4/gap-6).
- Card images: 16:9 or 4:3 aspect, not 1:1 squares taking half the screen.
- Typography: text-sm for body, text-base for card titles. Reserve text-lg+
  for page headers only.
- Buttons: py-2 px-3 default. Never py-4 unless it's a primary page CTA.
- Vertical rhythm: prefer space-y-3 over space-y-6.
- Icons: w-4 h-4 inline, w-5 h-5 for prominent. Not w-8+ unless decorative.

When in doubt, make it MORE compact. If a design feels too dense, Ricky will
ask to loosen it — assume compact until told otherwise.

Do NOT produce "Apple-style" generous-whitespace mobile layouts.
