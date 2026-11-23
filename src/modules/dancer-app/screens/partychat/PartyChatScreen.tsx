import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { SheetView, useKeyboardInset } from '@/modules/organiser/ui';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { PARTY_CHAT_ENABLED } from '../nights/partyChatFlag';

const NIGHTS = '/app/nights';
const MAX = 500;
const POLL_MS = 5000;
const ACCENT = 'bg-[var(--da-violet,#7c5cff)] text-[#14101f]';
const BTN = 'min-h-[44px] rounded-[12px] px-[14px] text-[15px] font-bold';

export type ChatMsg = { id: string; profile_id: string | null; display_name: string | null; avatar_url: string | null; body: string; created_at: string; mine: boolean };
export type ChatInfo = { id: string; city_name: string | null; party_date: string | null; closes_at: string | null; state: 'open' | 'closed' };
type Page = { chat: ChatInfo; messages: ChatMsg[]; has_more: boolean };
type Fetched = { kind: 'ok'; page: Page } | { kind: 'not_member' } | { kind: 'error' };

const str = (v: unknown) => (typeof v === 'string' ? v : null);
const parseMsg = (m: unknown): ChatMsg | null => {
  const d = (m ?? {}) as Record<string, unknown>;
  if (typeof d.id !== 'string' || typeof d.body !== 'string' || typeof d.created_at !== 'string') return null;
  return { id: d.id, profile_id: str(d.profile_id), display_name: str(d.display_name), avatar_url: str(d.avatar_url), body: d.body, created_at: d.created_at, mine: d.mine === true };
};

export const fetchChat = async (chatId: string, before: string | null = null): Promise<Fetched> => {
  try {
    const { data, error } = await rpcLoose('get_party_chat_v1', { p_chat_id: chatId, p_before: before, p_limit: 50 });
    if (error) return { kind: 'error' };
    const d = (data ?? {}) as Record<string, unknown>;
    if (d.ok !== true) return d.error === 'not_member' ? { kind: 'not_member' } : { kind: 'error' };
    const c = (d.chat ?? {}) as Record<string, unknown>;
    if (typeof c.id !== 'string') return { kind: 'error' };
    const chat: ChatInfo = { id: c.id, city_name: str(c.city_name), party_date: str(c.party_date), closes_at: str(c.closes_at), state: c.state === 'closed' ? 'closed' : 'open' };
    const messages = (Array.isArray(d.messages) ? d.messages : []).map(parseMsg).filter((m): m is ChatMsg => !!m);
    return { kind: 'ok', page: { chat, messages, has_more: d.has_more === true } };
  } catch {
    return { kind: 'error' };
  }
};

/** One command RPC: the error string the server sent, or null for ok. */
const command = async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
  try {
    const { data, error } = await rpcLoose(fn, args);
    if (error) return 'call_failed';
    const d = (data ?? {}) as { ok?: unknown; error?: unknown };
    return d.ok === true ? null : typeof d.error === 'string' ? d.error : 'call_failed';
  } catch {
    return 'call_failed';
  }
};

/** Merge by id (poll and older pages overlap), oldest first. */
export const mergeMessages = (a: ChatMsg[], b: ChatMsg[]): ChatMsg[] => {
  const map = new Map<string, ChatMsg>();
  for (const m of [...a, ...b]) map.set(m.id, m);
  return [...map.values()].sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : 0));
};

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' });
export const hhmm = (iso: string) => timeFmt.format(new Date(iso));
// Own London-day key (not lib/londonDate: importing more of it grows the shared lib-event-rules chunk, which the event route's budget counts).
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (d: Date) => keyFmt.format(d);
export const dayLabel = (iso: string, now: Date = new Date()): string => {
  const key = dayKey(new Date(iso));
  const today = dayKey(now);
  if (key === today) return 'Today';
  const yesterday = new Date(new Date(`${today}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  if (key === yesterday) return 'Yesterday';
  return dayFmt.format(new Date(iso)).replace(',', '');
};
const partyDate = (d: string | null) => (d ? dayFmt.format(new Date(`${d.slice(0, 10)}T12:00:00Z`)).replace(',', '') : null);

const SEND_ERRORS: Record<string, string> = { too_long: 'Keep it under 500 characters.', slow_down: 'Slow down a little.' };

const Avatar = ({ m }: { m: ChatMsg }) => <PersonAvatar photoUrl={m.avatar_url} name={m.display_name} size={28} />;

const PartyChatScreen = () => {
  const { chatId = '' } = useParams();
  const nav = useNavigate();
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'not_member' | 'error'>('loading');
  const [text, setText] = useState('');
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reportMode, setReportMode] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const stick = useRef(true);
  const seen = useRef(new Set<string>());
  const kb = useKeyboardInset();

  const markRead = useCallback(() => { void command('mark_party_chat_read_v1', { p_chat_id: chatId }); }, [chatId]);

  const apply = useCallback((r: Fetched, older = false) => {
    if (r.kind === 'not_member') { setPhase('not_member'); return; }
    if (r.kind === 'error') { setPhase((p) => (p === 'loading' ? 'error' : p)); return; }
    setChat(r.page.chat);
    stick.current = !older && atBottom.current;
    if (older) setHasMore(r.page.has_more);
    else setHasMore((h) => (seen.current.size === 0 ? r.page.has_more : h));
    setMsgs((cur) => mergeMessages(cur, r.page.messages));
    setPhase('ready');
    const fresh = r.page.messages.some((m) => !seen.current.has(m.id));
    r.page.messages.forEach((m) => seen.current.add(m.id));
    if (fresh && !older && !document.hidden) markRead();
  }, [markRead]);

  useEffect(() => {
    if (!chatId) return;
    let live = true;
    const tick = async () => { if (!document.hidden) { const r = await fetchChat(chatId); if (live) apply(r); } };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    const vis = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { live = false; window.clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [chatId, apply]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, phase, kb.inset]);

  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3500); return () => window.clearTimeout(t); }, [toast]);

  const closed = chat?.state === 'closed';
  const send = async () => {
    const body = text.trim();
    if (!body || sending || closed) return;
    setSending(true);
    setSendErr(null);
    const err = await command('post_party_chat_message_v1', { p_chat_id: chatId, p_body: body });
    setSending(false);
    if (!err) {
      setText('');
      stick.current = true;
      const r = await fetchChat(chatId);
      apply(r);
      return;
    }
    if (err === 'closed') setChat((c) => (c ? { ...c, state: 'closed' } : c));
    else if (err === 'not_member') setPhase('not_member');
    else if (err === 'empty') setSendErr(null);
    else setSendErr(SEND_ERRORS[err] ?? 'Couldn\u2019t send. Try again.');
  };

  const leave = async () => {
    setBusy(true);
    const err = await command('leave_party_chat_v1', { p_chat_id: chatId });
    setBusy(false);
    if (!err || err === 'not_member') { nav(NIGHTS, { replace: true }); return; }
    setLeaving(false);
    setToast('Couldn\u2019t leave. Try again.');
  };

  const report = async () => {
    if (!reportId) return;
    setBusy(true);
    const err = await command('report_party_chat_message_v1', { p_message_id: reportId, p_reason: reason });
    setBusy(false);
    setReportId(null);
    setReason(null);
    setReportMode(false);
    setToast(err && err !== 'own_message' ? 'Couldn\u2019t send the report. Try again.' : 'Thanks, we\u2019ll look at it.');
  };

  const older = async () => {
    if (!msgs[0]) return;
    apply(await fetchChat(chatId, msgs[0].created_at), true);
  };

  const rows = useMemo(() => {
    let last = '';
    return msgs.map((m) => {
      const label = dayLabel(m.created_at);
      const divider = label !== last ? label : null;
      last = label;
      return { m, divider };
    });
  }, [msgs]);

  if (phase === 'not_member') {
    return (
      <main data-testid="party-chat-not-member" className="grid min-h-[100dvh] place-content-center gap-[14px] bg-background p-[16px] text-center text-foreground">
        <p className="m-0 text-[17px] font-bold">You&rsquo;re not in this chat.</p>
        <button type="button" onClick={() => nav(NIGHTS)} className={`${BTN} ${ACCENT}`}>Back to Nights</button>
      </main>
    );
  }
  if (phase === 'error') {
    return (
      <main data-testid="party-chat-error" className="grid min-h-[100dvh] place-content-center gap-[14px] bg-background p-[16px] text-center text-foreground">
        <p className="m-0 text-[15px]">Couldn&rsquo;t load the chat.</p>
        <button type="button" onClick={() => nav(NIGHTS)} className={`${BTN} ${ACCENT}`}>Back to Nights</button>
      </main>
    );
  }

  const date = partyDate(chat?.party_date ?? null);
  const item = 'flex min-h-[44px] w-full items-center px-[14px] text-left text-[15px]';
  return (
    <main data-testid="party-chat" className="fixed inset-x-0 top-0 z-10 flex flex-col overflow-x-hidden bg-background text-foreground" style={{ height: kb.height ? `${kb.height}px` : '100dvh' }}>
      <header className="relative flex items-center gap-[4px] border-b border-[var(--line)] px-[4px] py-[6px]">
        <button type="button" aria-label="Back to Nights" data-testid="party-chat-back" onClick={() => nav(NIGHTS)} className="grid h-[44px] w-[44px] place-items-center"><ArrowLeft size={22} /></button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[16px] font-extrabold">Party chat{chat?.city_name ? ` \u00b7 ${chat.city_name}` : ''}</h1>
          {date && <p data-testid="party-chat-date" className="m-0 text-[13px] text-[var(--mut)]">{date}</p>}
        </div>
        <button type="button" aria-label="Menu" aria-expanded={menu} data-testid="party-chat-menu" onClick={() => setMenu((v) => !v)} className="grid h-[44px] w-[44px] place-items-center"><MoreVertical size={22} /></button>
        {menu && (
          <div role="menu" className="absolute right-[8px] top-[52px] z-20 w-[200px] overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--card)] shadow-lg">
            <button type="button" role="menuitem" data-testid="party-chat-leave" className={item} onClick={() => { setMenu(false); setLeaving(true); }}>Leave chat</button>
            <button type="button" role="menuitem" data-testid="party-chat-report" className={item} onClick={() => { setMenu(false); setReportMode(true); }}>Report a message</button>
          </div>
        )}
      </header>
      <p data-testid="party-chat-notice" className="m-0 bg-[var(--card)] px-[12px] py-[6px] text-center text-[13px] text-[var(--mut)]">Admin can read this chat to keep it safe.</p>
      {reportMode && (
        <div data-testid="party-chat-report-banner" className="flex items-center justify-between gap-[8px] bg-[var(--da-violet,#7c5cff)] px-[12px] text-[14px] font-bold text-[#14101f]">
          <span>Tap a message to report it</span>
          <button type="button" data-testid="party-chat-report-cancel" onClick={() => setReportMode(false)} className="min-h-[44px] px-[8px] underline">Cancel</button>
        </div>
      )}
      <div ref={scroller} data-testid="party-chat-list" onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }} className="flex flex-1 flex-col gap-[6px] overflow-y-auto overflow-x-hidden px-[10px] py-[10px]">
        {hasMore && <button type="button" data-testid="party-chat-older" onClick={() => void older()} className="min-h-[44px] self-center px-[12px] text-[14px] font-bold underline">Show earlier messages</button>}
        {phase === 'ready' && rows.length === 0 && <p className="m-auto text-[14px] text-[var(--mut)]">No messages yet. Say hi.</p>}
        {rows.map(({ m, divider }) => {
          const reportable = reportMode && !m.mine;
          return (
            <div key={m.id} className="grid gap-[6px]">
              {divider && <div data-testid="party-chat-day" className="self-center justify-self-center rounded-full bg-[var(--card)] px-[10px] py-[2px] text-[12px] text-[var(--mut)]">{divider}</div>}
              <div className={`flex items-end gap-[6px] ${m.mine ? 'justify-end' : 'justify-start'}`}>
                {!m.mine && <Avatar m={m} />}
                <div
                  data-testid="party-chat-msg"
                  data-mine={m.mine}
                  role={reportable ? 'button' : undefined}
                  tabIndex={reportable ? 0 : undefined}
                  onClick={reportable ? () => setReportId(m.id) : undefined}
                  onKeyDown={reportable ? (e) => { if (e.key === 'Enter') setReportId(m.id); } : undefined}
                  className={`max-w-[78%] rounded-[14px] px-[10px] py-[6px] ${m.mine ? ACCENT : 'bg-[var(--card)]'} ${reportable ? 'min-h-[44px] outline outline-2 outline-[var(--da-violet,#7c5cff)]' : ''}`}
                >
                  {!m.mine && <p className="m-0 text-[12px] font-bold opacity-80">{m.display_name ?? 'Dancer'}</p>}
                  <p className="m-0 whitespace-pre-wrap break-words text-[15px]">{m.body}</p>
                  <p className="m-0 text-right text-[11px] opacity-70">{hhmm(m.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="border-t border-[var(--line)] p-[8px]">
        {closed ? (
          <p data-testid="party-chat-closed" className="m-0 py-[10px] text-center text-[15px] text-[var(--mut)]">This chat is closed</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="grid gap-[4px]">
            {sendErr && <p data-testid="party-chat-send-error" role="alert" className="m-0 text-[13px] text-[var(--mut)]">{sendErr}</p>}
            <div className="flex items-center gap-[8px]">
              <input data-testid="party-chat-input" value={text} maxLength={MAX} onChange={(e) => { setText(e.target.value); setSendErr(null); }} aria-label="Message" placeholder="Message" className="min-h-[44px] min-w-0 flex-1 rounded-[22px] border border-[var(--line)] bg-transparent px-[14px] text-[16px]" />
              <button type="submit" data-testid="party-chat-send" disabled={!text.trim() || sending} className={`${BTN} ${ACCENT} disabled:opacity-50`}>Send</button>
            </div>
            {text.length >= MAX - 50 && <p data-testid="party-chat-counter" className="m-0 text-right text-[12px] text-[var(--mut)]">{text.length}/{MAX}</p>}
          </form>
        )}
      </footer>
      {toast && <div role="status" data-testid="party-chat-toast" className="fixed inset-x-[16px] bottom-[84px] z-30 rounded-[12px] bg-[var(--card)] px-[14px] py-[12px] text-center text-[14px] font-bold shadow-lg">{toast}</div>}
      {leaving && (
        <SheetView open onOpenChange={(o) => { if (!o && !busy) setLeaving(false); }} title="Leave this chat?" testId="party-chat-leave-sheet" closeLabel="Dismiss">
          <p className="m-0 mb-[12px] text-[15px]">You can&rsquo;t rejoin once you leave.</p>
          <div className="grid gap-[8px]">
            <button type="button" data-testid="party-chat-leave-confirm" disabled={busy} onClick={() => void leave()} className={`${BTN} bg-[#c62828] text-white disabled:opacity-60`}>Leave</button>
            <button type="button" data-testid="party-chat-leave-stay" disabled={busy} onClick={() => setLeaving(false)} className={`${BTN} border border-[var(--line)]`}>Stay</button>
          </div>
        </SheetView>
      )}
      {reportId && (
        <SheetView open onOpenChange={(o) => { if (!o && !busy) { setReportId(null); setReason(null); } }} title="Report this message" testId="party-chat-report-sheet" closeLabel="Dismiss">
          <div className="mb-[12px] flex flex-wrap gap-[8px]">
            {['Spam', 'Rude or unsafe', 'Other'].map((r) => (
              <button key={r} type="button" data-testid="party-chat-reason" aria-pressed={reason === r} onClick={() => setReason(r)} className={`min-h-[44px] rounded-full border border-[var(--line)] px-[14px] text-[14px] font-bold ${reason === r ? ACCENT : ''}`}>{r}</button>
            ))}
          </div>
          <button type="button" data-testid="party-chat-report-send" disabled={busy} onClick={() => void report()} className={`${BTN} ${ACCENT} w-full disabled:opacity-60`}>Send report</button>
        </SheetView>
      )}
    </main>
  );
};

/** The route element (AnimatedRoutes): flag off = back to /account with zero RPC calls; signed out = the normal auth redirect. */
export const PartyChatRoute = () => (PARTY_CHAT_ENABLED() ? <AuthGuard><PartyChatScreen /></AuthGuard> : <Navigate to="/account" replace />);
export default PartyChatScreen;
