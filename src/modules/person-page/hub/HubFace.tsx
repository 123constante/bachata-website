import { NationalityFlag } from '@/components/people/NationalityFlag';
import { optimizedImageUrl } from '@/lib/imageCdn';
import type { PersonRole } from '@/lib/searchEntities';
import { initialsOf } from '../wall/model';
import { HUB, TILE } from '../wall/tokens';
import { usePhotoFallback } from '../wall/usePhotoFallback';

/** Big rounded-square face. No photo, or a photo that fails to load = initials in the lead accent (never a broken image). */
export function HubFace({ photo, name, lead, flagCode }: { photo: string | null; name: string; lead: PersonRole; flagCode: string | null }) {
  const a = TILE[lead];
  const { showPhoto, imgProps } = usePhotoFallback(photo);
  return (
    <div className="relative shrink-0" style={{ width: HUB.face, height: HUB.face }}>
      <div
        data-testid="hub-face"
        data-face={showPhoto ? 'photo' : 'initials'}
        className="h-full w-full overflow-hidden"
        style={{ borderRadius: HUB.faceRadius, background: a.bg, border: `${HUB.heroBorder}px solid ${a.edge}` }}
      >
        {showPhoto ? (
          <img
            src={optimizedImageUrl(photo as string, 480)}
            alt=""
            width={HUB.face}
            height={HUB.face}
            loading="eager"
            className="h-full w-full object-cover"
            {...imgProps}
          />
        ) : (
          <div aria-hidden="true" className="flex h-full w-full items-center justify-center" style={{ color: a.ink }}>
            <span style={{ fontSize: HUB.initials, fontWeight: 800, letterSpacing: 1 }}>{initialsOf(name)}</span>
          </div>
        )}
      </div>
      <NationalityFlag code={flagCode} size={HUB.flagFrom} placement="inset" />
    </div>
  );
}
