# Ticket picker B1 fix round 2 handover

Done:
- `pickerModel.ts` CANCELLED_NOTE raw U+2019 replaced with the `’` escape. No other raw U+2018/2019/201C/201D/2013/2014/2026 in non-test files under src/modules/tickets.
- `npx vitest run src/modules/tickets`: 25 files, 858 tests, all pass.
- Nit "static import in EventTicketsPage": already a static import (`import { TicketPickerB1 } from './TicketPickerB1'`), nothing to change.

Left (nit, not done): cleanBasket silently drops a hold when it clamps (cap or limit). Needs a UI note, more than 10 lines with a test.

Not verified: browser walk (text-only change); flag ticketPickerB1 stays OFF.
