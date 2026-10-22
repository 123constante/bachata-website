import { Link } from 'react-router-dom';
import { NationalityFlag, TILE_FLAG_SIZE } from '@/components/people/NationalityFlag';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { emitProfileView } from '@/lib/profileViewEmit';
import { initialsOf, type WallList, type WallPerson } from './model';
import { RoleChip } from './RoleChip';
import { usePhotoFallback } from './usePhotoFallback';
import { DATE_CHIP, FOCUS_RING, SIZE, TILE, WALL } from './tokens';

function Face({ person }: { person: WallPerson }) {
  const a = TILE[person.lead];
  const { showPhoto, imgProps } = usePhotoFallback(person.photo);
  return (
    <div
      data-testid="wall-face"
      data-face={showPhoto ? 'photo' : 'initials'}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: '1 / 1', borderRadius: SIZE.tileRadius, background: a.bg, border: `1.5px solid ${a.edge}` }}
    >
      {showPhoto ? (
        <img
          src={optimizedImageUrl(person.photo as string, 320)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          {...imgProps}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center"
          style={{
            color: a.ink,
            backgroundImage: 'radial-gradient(circle at 20% 15%, rgba(255,255,255,.25) 0 18%, transparent 19%), repeating-linear-gradient(135deg, rgba(0,0,0,.05) 0 6px, transparent 6px 12px)',
          }}
        >
          <span style={{ fontSize: SIZE.initials, fontWeight: 800, letterSpacing: 1 }}>{initialsOf(person.name)}</span>
        </div>
      )}
    </div>
  );
}

/** The whole tile is ONE link. No flag / date / chips when the person has none (no placeholder text). */
export function WallTile({ person, list }: { person: WallPerson; list: WallList }) {
  const body = (
    <>
      <div className="relative">
        <Face person={person} />
        <NationalityFlag code={person.flagCode} size={TILE_FLAG_SIZE} placement="inset" />
        {person.dateLabel ? (
          <span
            data-testid="date-chip"
            className="absolute bottom-1 left-1"
            style={{
              background: DATE_CHIP.bg, color: DATE_CHIP.text, border: `1px solid ${DATE_CHIP.border}`,
              fontSize: SIZE.chip, fontWeight: 800, lineHeight: '14px', padding: '0 6px', borderRadius: 999,
            }}
          >
            <span className="sr-only">Next gig </span>
            {person.dateLabel}
          </span>
        ) : null}
      </div>
      <div
        data-testid="tile-name"
        className="mt-1 text-center"
        style={{ color: WALL.text, fontSize: SIZE.name, fontWeight: 700, lineHeight: `${SIZE.nameLine}px`, overflowWrap: 'anywhere' }}
      >
        {person.name}
      </div>
      {person.tags.length > 0 ? (
        <div className="mt-1 flex flex-wrap justify-center gap-[3px]" data-testid="role-labels">
          {person.tags.map((t) => <RoleChip key={t.role} role={t.role} label={t.label} />)}
        </div>
      ) : null}
    </>
  );
  if (!person.href) return <div className="block min-w-0" data-testid="wall-tile" data-lead={person.lead}>{body}</div>;
  return (
    <Link
      to={person.href}
      className={`block min-w-0 rounded-[12px] ${FOCUS_RING}`}
      data-testid="wall-tile"
      data-lead={person.lead}
      onClick={() => emitProfileView({ personId: person.id, profileType: person.profileType, context: `listing:${list}` })}
    >
      {body}
    </Link>
  );
}
