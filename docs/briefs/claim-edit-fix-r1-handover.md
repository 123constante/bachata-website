# claim-edit-fix-r1 handover

Branch `claude/claim-edit-fix-r1`. All four brief items done; no database change.

1. **Gallery for every date** &mdash; "Photos" field on Details after the cover photo (`DetailsScreen.tsx`), upload via `uploadEventPicture`, saved in the same Save as `series.upsert` `default_gallery` (existing command, no new RPC). Per-date photos untouched.
2. **Edit rows up** &mdash; `EditRows` in `EventPage.tsx` renders above Sessions and Coming up; About keeps its own card without the rows.
3. **Field order** &mdash; Details: name, about, cover photo, photos, ticket link, then a "More details" heading with music, where, Instagram, videos, chat, kind. No field removed.
4. **One-date wording** &mdash; `model/saveWords.ts` (`hasOneDate`, `saveWordsFor`) is the one mapping for Details and Prices: "Save" and "Saved. Dancers see it now." for exactly one date.

Tests: `p3/screens/__tests__/claimEdit.matrix.test.tsx` (12 shapes x event page / Details order / untouched save / shared words, plus gallery send, remove, failed upload, 30-photo cap). Red first: 32 of them fail with EventPage and Details reverted.

Left for the orchestrator: live 390x844 walk (no walk tooling in this sandbox), light/dark check, Vercel preview.
