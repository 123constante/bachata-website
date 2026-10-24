import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { Avatar } from '../../frame/Avatar';
import { TAP } from '../../roleSwitch';
import { FOCUS_RING } from '../../wall/tokens';
import { FONT, ROLE_COLOUR, TEACHER_PAPER as P, WORLD } from '../tokens';
import type { TeacherWorldView } from './model';

const T = WORLD.teacher;
const FACE = 100;
const display = { fontFamily: FONT.teacherDisplay, fontWeight: 700 } as const;
const SECTION = { background: T.section.background, border: `1px solid ${T.section.border}` } as const;
const OUTLINE = { minHeight: TAP, fontSize: 14, color: T.accent, border: `1px solid ${T.avatar.ring}` } as const;

/**
 * The teacher world (people arc S4): the studio timetable. A light lilac card (owner D7) with the
 * TEACHER band, the face (photo or initials), the name in Fraunces with the flag (never the code as
 * text), "Teaches in <city>" and "Speaks <languages>"; then the next classes, time first; then ONE
 * contact row and the dancer invite. A teacher with nothing coming up gets one button to the classes
 * calendar, so a thin page still looks finished. All copy comes in on `view` (model.ts).
 */
export function TeacherWorld({ view, photo, classes, onRetry }: {
  view: TeacherWorldView;
  photo: string | null;
  /** The class read: rows show only when 'ready'. */
  classes: 'loading' | 'failed' | 'ready';
  onRetry: () => void;
}) {
  return (
    <div data-testid="teacher-world" className="flex flex-col gap-3" style={{ fontFamily: FONT.body, color: T.ink }}>
      <div data-testid="teacher-card" className="overflow-hidden rounded-[18px]" style={{ background: T.card.background, color: T.card.ink, boxShadow: '0 10px 30px #00000066' }}>
        <div className="relative flex items-center px-[14px]" style={{ height: 34, background: P.band }}>
          <span className="font-extrabold" style={{ fontSize: 12, letterSpacing: '0.24em', color: P.bandInk }}>TEACHER</span>
          <i
            aria-hidden
            className="absolute"
            style={{
              right: 14, top: 11, width: 40, height: 12,
              background: `radial-gradient(circle at 6px 6px, ${T.ground} 5px, transparent 5.5px), radial-gradient(circle at 34px 6px, ${T.ground} 5px, transparent 5.5px)`,
            }}
          />
        </div>
        <div
          className="flex items-center gap-[14px] px-[14px] pb-[18px] pt-4"
          style={{ backgroundImage: `repeating-linear-gradient(0deg, ${P.rule} 0 1px, transparent 1px 26px)`, backgroundPosition: '0 6px' }}
        >
          <div className="relative flex-none" style={{ width: FACE, height: FACE }}>
            <Avatar name={view.big} photo={photo} world="teacher" size={FACE} />
          </div>
          <div className="min-w-0">
            <h1 data-testid="teacher-name" className="m-0" style={{ ...display, fontSize: view.big.length > 18 ? 23 : 27, lineHeight: 1.1, color: T.card.ink, overflowWrap: 'anywhere' }}>
              {view.big}
              {view.flag ? (
                <span data-testid="teacher-flag" className="relative ml-2 inline-block align-middle" style={{ width: 24, height: 16 }}>
                  <NationalityFlag code={view.flag} size={48} placement="inset" inset={0} />
                </span>
              ) : null}
            </h1>
            {view.lines.map((l) => (
              <p key={l} data-testid="teacher-line" className="m-0 mt-[6px] font-semibold" style={{ fontSize: 14, color: T.card.muted }}>{l}</p>
            ))}
          </div>
        </div>
      </div>

      {classes === 'loading' ? (
        <div data-testid="teacher-classes-loading" aria-busy="true" aria-label="Loading classes" className="h-[120px] animate-pulse rounded-[18px]" style={SECTION} />
      ) : null}

      {classes === 'failed' ? (
        <section data-testid="teacher-classes-failed" className="rounded-[18px] px-3 py-[14px]" style={SECTION}>
          <p className="m-0" style={{ fontSize: 14, color: P.rowMuted }}>Couldn&rsquo;t load the classes.</p>
          <button type="button" onClick={onRetry} className={`mt-2 w-full rounded-full font-bold ${FOCUS_RING}`} style={OUTLINE}>
            Try again
          </button>
        </section>
      ) : null}

      {/* Where the classes would be: nothing coming up says so, then what the visitor can do. */}
      {classes === 'ready' && view.emptyAction ? (
        <div data-testid="teacher-empty" className="flex flex-col gap-2">
          <p data-testid="teacher-empty-note" className="m-0 text-center" style={{ fontSize: 14, color: P.rowMuted }}>{view.emptyAction.note}</p>
          <Link
            to={view.emptyAction.href}
            data-testid="teacher-empty-action"
            className={`flex items-center justify-center rounded-full font-extrabold ${FOCUS_RING}`}
            style={{ minHeight: TAP, fontSize: 14, color: ROLE_COLOUR.teacher.on, background: ROLE_COLOUR.teacher.fill }}
          >
            {view.emptyAction.label}
          </Link>
        </div>
      ) : null}

      {classes === 'ready' && view.upcoming.length ? (
        <section data-testid="teacher-classes" className="rounded-[18px] px-3 py-[14px]" style={SECTION}>
          <h2 className="m-0 mb-2" style={{ ...display, fontSize: 22, lineHeight: 1.15, color: T.ink }}>{view.heading}</h2>
          <div className="flex flex-col gap-[6px]">
            {view.upcoming.map((c) => (
              <Link
                key={c.eventId}
                to={`/event/${c.eventId}`}
                data-testid="teacher-class"
                className={`flex items-center gap-[14px] rounded-[14px] px-3 py-2 ${FOCUS_RING}`}
                style={{ minHeight: 60, background: T.section.row, borderLeft: `4px solid ${T.accent}` }}
              >
                {c.time ? <span data-testid="teacher-class-time" className="flex-none" style={{ ...display, fontSize: 22, color: P.time }}>{c.time}</span> : null}
                <span className="flex min-w-0 flex-1 flex-col">
                  {c.date ? <b data-testid="teacher-class-date" style={{ fontSize: 15, color: P.rowInk }}>{c.date}</b> : null}
                  <small style={{ fontSize: 13, color: P.rowMuted, overflowWrap: 'anywhere' }}>{c.venue ? `${c.name} · ${c.venue}` : c.name}</small>
                </span>
                <ChevronRight className="h-4 w-4 flex-none" style={{ color: P.rowMuted }} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* After the classes, so it does not jump down when they arrive. */}
      {classes !== 'loading' && view.contact ? (
        <a
          href={view.contact.href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="teacher-contact"
          className={`flex items-center gap-3 rounded-[14px] px-3 py-2 ${FOCUS_RING}`}
          style={{ minHeight: TAP, ...SECTION }}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <small className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: P.contactKey }}>{view.contact.label}</small>
            <span className="truncate" style={{ fontSize: 15, color: P.rowInk }}>{view.contact.value}</span>
          </span>
          <ChevronRight className="h-4 w-4 flex-none" style={{ color: P.rowMuted }} aria-hidden />
        </a>
      ) : null}

      {view.invite ? (
        <Link
          to={view.invite.href}
          data-testid="teacher-invite"
          className={`flex items-center justify-center rounded-full px-3 text-center font-bold ${FOCUS_RING}`}
          style={{ minHeight: TAP, fontSize: 14, color: WORLD.dancer.avatar.ink, background: WORLD.dancer.avatar.background, border: `1px solid ${WORLD.dancer.avatar.ring}` }}
        >
          {view.invite.label}
        </Link>
      ) : null}
    </div>
  );
}
