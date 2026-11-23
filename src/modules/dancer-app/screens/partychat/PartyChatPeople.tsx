import { ChevronRight } from 'lucide-react';
import { SheetView } from '@/modules/organiser/ui';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import type { ChatMember, PartyRole } from './usePartyChatPeople';

const BADGE: Record<PartyRole, string> = { organiser: 'Organiser', dj: 'DJ', instructor: 'Instructor' };
const FACES = 8;

/** Online first, then the rest in join order. */
export const splitMembers = (members: ChatMember[], online: Set<string>) => ({
  on: members.filter((m) => online.has(m.profile_id)),
  off: members.filter((m) => !online.has(m.profile_id)),
});

export const PartyChatStrip = ({ members, online, onOpen }: { members: ChatMember[]; online: Set<string>; onOpen: () => void }) => {
  const { on, off } = splitMembers(members, online);
  const sorted = [...on, ...off];
  const shown = sorted.slice(0, FACES);
  const rest = sorted.length - shown.length;
  return (
    <button type="button" data-testid="party-chat-strip" onClick={onOpen} className="grid min-h-[44px] w-full gap-[6px] border-b border-[var(--line)] px-[12px] py-[8px] text-left">
      <span className="flex items-center justify-between gap-[8px] text-[14px] font-bold">
        <span className="flex items-center gap-[8px]">
          <span aria-hidden="true" className="party-chat-pulse inline-block h-[8px] w-[8px] rounded-full bg-[var(--hot,#ff3d8b)]" />
          <span data-testid="party-chat-strip-count">{members.length} here tonight</span>
        </span>
        <span className="text-[var(--mut)]">See all &rsaquo;</span>
      </span>
      <span className="flex items-center gap-[6px]">
        {shown.map((m) => (
          <span key={m.profile_id} data-testid="party-chat-face" data-online={online.has(m.profile_id)} className="relative inline-block h-[30px] w-[30px]">
            <PersonAvatar photoUrl={m.avatar_url} name={m.first_name} size={30} />
            {online.has(m.profile_id) && <span aria-hidden="true" className="absolute bottom-0 right-0 h-[9px] w-[9px] rounded-full border border-[var(--da-bg)] bg-[#2ecc71]" />}
          </span>
        ))}
        {rest > 0 && <span data-testid="party-chat-more" className="text-[13px] text-[var(--mut)]">+{rest}</span>}
      </span>
      <style>{'@media (prefers-reduced-motion: no-preference){.party-chat-pulse{animation:party-chat-pulse 1.6s ease-in-out infinite}}@keyframes party-chat-pulse{50%{opacity:.35}}'}</style>
    </button>
  );
};

const Row = ({ m, onPick }: { m: ChatMember; onPick: (id: string) => void }) => (
  <button type="button" data-testid="party-chat-person" onClick={() => onPick(m.profile_id)} className="flex min-h-[44px] w-full items-center gap-[10px] py-[4px] text-left text-[15px]">
    <PersonAvatar photoUrl={m.avatar_url} name={m.first_name} size={30} />
    <span className="min-w-0 flex-1 truncate font-bold">{m.first_name ?? 'Dancer'}</span>
    {m.top_role && <span data-testid="party-chat-badge" className="rounded-full bg-[var(--card)] px-[8px] py-[2px] text-[12px] font-bold">{BADGE[m.top_role]}</span>}
    <ChevronRight size={18} aria-hidden="true" />
  </button>
);

export const PartyChatPeopleSheet = ({ members, online, onClose, onPick }: { members: ChatMember[]; online: Set<string>; onClose: () => void; onPick: (id: string) => void }) => {
  const { on, off } = splitMembers(members, online);
  return (
    <SheetView open onOpenChange={(o) => { if (!o) onClose(); }} title={`${members.length} here tonight`} testId="party-chat-people-sheet" closeLabel="Dismiss">
      {on.length > 0 && (
        <section className="mb-[10px]">
          <h3 className="m-0 mb-[4px] text-[13px] font-bold text-[var(--mut)]">Online now &middot; {on.length}</h3>
          {on.map((m) => <Row key={m.profile_id} m={m} onPick={onPick} />)}
        </section>
      )}
      {off.length > 0 && (
        <section>
          <h3 className="m-0 mb-[4px] text-[13px] font-bold text-[var(--mut)]">Others &middot; {off.length}</h3>
          {off.map((m) => <Row key={m.profile_id} m={m} onPick={onPick} />)}
        </section>
      )}
    </SheetView>
  );
};
