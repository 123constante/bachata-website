# Editor v2 slice 3 handover (This-night card)

Top note: the prototype is not reachable from the cloud; built from the brief's embedded CSS, markup and copy. Fact taps (When, Where, Price, Description, Flyer pill) are inert on purpose (`onOpen` undefined): their sheets belong to slices 7, 8, 14, 8, 9. Nothing links to an old page.

## Done
- `NightCard.tsx`, `Facts.tsx` (`Fact`, `priceLabel`, `aboutShort`), `DatesSheet.tsx`, copy lines, CSS under `.ev2`, wiring in `EditorV2.tsx` (slot, sheet, `useSaveNow`, toast).
- Tag + Back to usual keys: Where = venue_id/city_id, Price = passes/ticket_url, Description = description, Flyer = cover_image_url (flyer text only, no Back button: slice 9). Back to usual sends `occurrence.set_override` with those keys null; Undo puts the values from `fetchDateDetail` back (city_id has no read, so Undo is absent when city_id is owned).
- When never shows the tag: no override key exists for times in `override_keys` (not invented).
- Price: the read has no door price, Stripe state or ticket count, so mode is `link` when the date/series has a ticket url, else `none` ("Add a ticket"). Slice 12 supplies `payMode.ts`. All five modes are unit-tested on `priceLabel`.
- `EditorV2` lost its `onMoreDates` prop (sheet is inside it); nothing else used it.

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3` 180 files pass (nightCard.test.tsx new; shell test given QueryClient + mocks).
- Not verified: 390x844 browser walk, prod shape survey, prototype pixel match, `pre-ship`, bundle budget.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| More dates chip | sheet All dates | prototype |
| date row in sheet | sheet closes, tab This night, that night, scroll top | prototype |
| Back to usual | stays; change gone; toast + Undo | prototype |
| When / Where / Price / Description / Flyer and photos | nothing yet (later slices) | prototype (inert) |
