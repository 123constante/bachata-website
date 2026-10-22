import { useEffect, useRef, useState } from 'react';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { optimizedImageUrl } from '@/lib/imageCdn';
import type { PersonRole } from '@/lib/searchEntities';
import { initialsOf } from '../wall/model';
import { HUB, TILE } from '../wall/tokens';

/** Big rounded-square face. No photo, or a photo that fails to load = initials in the lead accent (never a broken image). */
export function HubFace({ photo, name, lead, flagCode }: { photo: string | null; name: string; lead: PersonRole; flagCode: string | null }) {
  const a = TILE[lead];
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = !!photo && failed !== photo;
  // An SSR'd <img> can fail before hydration attaches onError: check once after mount.
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0 && photo) setFailed(photo);
  }, [photo]);
  return (
    <div className="relative shrink-0" style={{ width: HUB.face, height: HUB.face }}>
      <div
        data-testid="hub-face"
        data-face={showPhoto ? 'photo' : 'initials'}
        className="h-full w-full overflow-hidden"
        style={{ borderRadius: HUB.faceRadius, background: a.bg, border: `1.5px solid ${a.edge}` }}
      >
        {showPhoto ? (
          <img
            ref={img}
            src={optimizedImageUrl(photo as string, 320)}
            alt=""
            width={HUB.face}
            height={HUB.face}
            loading="eager"
            className="h-full w-full object-cover"
            onError={() => setFailed(photo)}
          />
        ) : (
          <div aria-hidden="true" className="flex h-full w-full items-center justify-center" style={{ color: a.ink }}>
            <span style={{ fontSize: HUB.initials, fontWeight: 800, letterSpacing: 1 }}>{initialsOf(name)}</span>
          </div>
        )}
      </div>
      <NationalityFlag code={flagCode} size={HUB.face} placement="inset" />
    </div>
  );
}
