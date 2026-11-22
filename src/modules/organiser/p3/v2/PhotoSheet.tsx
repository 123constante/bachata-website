import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';

const F = V2.flyerPhotos;

/** SH-PHOTO: one gallery item large, with Remove and Back. Controlled by FlyerSheet (a sheet swap, not a stack). */
export function PhotoSheet({ url, video, onRemove, onBack, onClose }: {
  url: string; video: boolean; onRemove: () => void | Promise<unknown>; onBack: () => void; onClose: () => void;
}) {
  return (
    <V2Sheet open title={video ? F.video : F.photo} onClose={onClose}>
      <div className="grp">
        <div data-testid="photo-big" style={{ aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 24,
          background: video ? 'linear-gradient(#14161C,#565B69)' : '#E9E9E9' }}>
          {video ? <span aria-hidden="true">&#9654;</span> : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        {video && <div className="box" style={{ wordBreak: 'break-all' }}><a href={url} target="_blank" rel="noopener noreferrer" data-testid="photo-link">{url}</a></div>}
        <button type="button" className="btn dan" data-testid="photo-remove" onClick={() => void onRemove()}>{video ? F.removeVideo : F.removePhoto}</button>
        <button type="button" className="btn sec" data-testid="photo-back" onClick={onBack}>{F.backToSheet}</button>
      </div>
    </V2Sheet>
  );
}
