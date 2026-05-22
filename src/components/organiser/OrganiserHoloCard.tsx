import { Link } from 'react-router-dom';
import { useState } from 'react';
import { emitProfileView } from '@/lib/profileViewEmit';
import './OrganiserHoloCard.css';

type Props = {
  id: string;
  name: string;
  avatarUrl: string | null;
  organisationCategory: string | null;
  cityName: string | null;
  eventCount: number;
  index: number;
};

const getMonogram = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3) || '?';

export const OrganiserHoloCard = ({
  id,
  name,
  avatarUrl,
  organisationCategory,
  cityName,
  eventCount,
  index,
}: Props) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!avatarUrl && !imgFailed;
  const serial = index.toString().padStart(3, '0');
  const typeLine = [organisationCategory, cityName].filter(Boolean).join(' \u00B7 ');
  const categoryLabel = (organisationCategory ?? '').toUpperCase() || 'ORGANISER';
  const eventLabel = `${eventCount} ${eventCount === 1 ? 'EVENT' : 'EVENTS'}`;

  return (
    <Link
      to={`/organisers/${id}`}
      onClick={() =>
        emitProfileView({
          personId: id,
          profileType: 'organiser',
          context: 'listing:organisers',
        })
      }
      className="holo-card"
      aria-label={`${name} \u2014 organiser profile`}
    >
      <div className="holo-card__inner">
        <div className="holo-card__banner">
          <span>&#9670; {categoryLabel} &middot; {serial}</span>
          <span>&#9670;</span>
        </div>

        <div className="holo-card__art">
          {showImage ? (
            <img
              className="holo-card__avatar"
              src={avatarUrl!}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="holo-card__monogram">{getMonogram(name)}</div>
          )}
        </div>

        <div className="holo-card__name">{name}</div>

        {typeLine && <div className="holo-card__type">{typeLine}</div>}

        <div className="holo-card__footer">
          <span>{eventLabel}</span>
        </div>
      </div>
    </Link>
  );
};

export default OrganiserHoloCard;
