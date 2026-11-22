import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchMyTickets } from '@/modules/tickets/myTicketsApi';
import { doorCodeText, type MyTicket } from '@/modules/tickets/myTicketsModel';
import TicketQrCode from '@/modules/tickets/TicketQrCode';
import DoorCodeLine from '@/modules/tickets/DoorCodeLine';
import { ticketDoorCode } from '@/modules/organiser/p3/door/doorFlags';
import { doorDate, stepTicket, ticketCountLine } from '../tickets/cardKit';

/**
 * Nights ticket QR, the ONE lazy chunk (brief #1920): (a) reads my_tickets_v1 once and hands the
 * tickets back through onTickets (renders nothing); (b) while `night` is set, draws the QR sheet.
 * signed_out / error = no tickets, no message. The reply is never logged; qrToken stays in props.
 */
export type QrNight = { occurrenceId: string; name: string; date: string | null };

/** The ticket read: renders nothing, hands the tickets back once. */
const NightTicketFeed = ({ onTickets }: { onTickets: (all: MyTicket[]) => void }) => {
  useEffect(() => {
    let live = true;
    void fetchMyTickets().then((r) => {
      if (live && r.kind === 'ok') onTickets(r.reply.tickets);
    });
    return () => {
      live = false;
    };
  }, [onTickets]);
  return null;
};

/** The sheet's body (NightsScreen draws the Sheet shell: optionsUi lives in the dancer-app chunk and this chunk must not import it). */
export const NightQrBody = ({ night, tickets }: { night: QrNight; tickets: MyTicket[] }) => {
  const [index, setIndex] = useState(0);
  if (tickets.length === 0) return null;
  const t = tickets[Math.min(index, tickets.length - 1)];
  const code = doorCodeText(t.shortCode, ticketDoorCode);
  const many = tickets.length > 1;
  const step = 'grid h-[44px] w-[44px] place-items-center rounded-[12px] border border-[var(--line)] bg-[var(--card)] text-[var(--fg)]';
  return (
    <div className="grid gap-[8px] text-center" data-night={night.occurrenceId}>
      {night.date && <p className="m-0 text-[14px]">{doorDate(night.date)}</p>}
      <p className="m-0 text-[13px] text-[var(--mut)]">{t.typeName ?? 'Ticket'}</p>
      <div className="mx-auto rounded-[12px] bg-white p-[12px]" style={{ width: 'min(88vw, 340px)' }}>
        {t.qrToken && <TicketQrCode token={t.qrToken} />}
      </div>
      {code && <DoorCodeLine code={code} checkedIn={false} testId="night-door-code" />}
      {many && (
        <div className="flex items-center justify-center gap-[12px]">
          <button type="button" className={step} aria-label="Previous ticket" data-testid="night-qr-prev" onClick={() => setIndex(stepTicket(index, -1, tickets.length))}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <span className="text-[13px]" data-testid="night-qr-count">{ticketCountLine(index, tickets.length)}</span>
          <button type="button" className={step} aria-label="Next ticket" data-testid="night-qr-next" onClick={() => setIndex(stepTicket(index, 1, tickets.length))}>
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default NightTicketFeed;
