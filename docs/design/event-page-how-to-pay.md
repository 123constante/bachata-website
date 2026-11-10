# Event page: "How to pay" line

## Brief
Organisers save payment methods (and the `free` code) in P3 Prices, but no live
surface told dancers. The only renderer, `sections/EventInfoSection.tsx`, has no
importer. Show one compact line on `/event/:id`: "Free", or the saved methods in
screen order. No database change; reads `pageModel.eventInfo.paymentMethods`.

## Chosen placement
A one-line `HowToPayLine` (`text-sm`, label plus text) rendered in `BentoPage.tsx`
directly below the tickets block (above the group-chat CTA), gated like the
group-chat CTA (hidden when over, cancelled). It sits where the dancer decides to
book, costs one line of mobile height, and needs no grid-packer change.

The mapping lives in `src/lib/paymentMethods.ts` (pure) and the organiser
`paymentModel.ts` re-exports it, so both screens read the same labels and the
public route does not import organiser command code.

## Rejected
- A full bento tile: a packer slot and a tile for one short sentence is heavy for
  a compact mobile layout, and an empty state would leave a hole in the grid.
- Reviving `sections/EventInfoSection`: dead code with no importer, wider shell
  layout, and it also carries dress code and age chips that are out of scope.
