import { useState } from 'react';
import { VideoEmbed } from '@/components/VideoEmbed';
import type { VenueVideo } from '@/lib/parseVenueVideoUrl';
import { VIDEO_CAP_CLASS, frameFor, frameStyle, hugStyle, resolveFrame, type MeasuredFrame } from '@/lib/videoFrame';

type VideoFrameProps = {
  video: VenueVideo;
  poster?: string | null;
  title: string;
  /** The caller's tile (border, corners, black fill) for a landscape video, verbatim. */
  boxClassName?: string;
  /** The same tile for a portrait/square video: border and corners, no width, no black fill. */
  hugClassName?: string;
  /** Width of hugClassName's own border/padding as a CSS length (e.g. '2px'), so the video keeps the full cap. */
  hugChrome?: string;
};

/**
 * VideoFrame — owns the box around <VideoEmbed>. Landscape (and Vimeo / ordinary
 * YouTube) = 16:9. Direct clips are measured on loadedmetadata; YouTube Shorts
 * are portrait from the URL. Anything below LANDSCAPE_MIN_RATIO is shown whole,
 * capped at 35svh (75svh from md up) (see src/lib/videoFrame.ts), and the tile
 * hugs it: only as wide as the video and centred, so there are no black bars.
 * The caller's tile is rendered here because only this component knows the shape.
 */
export const VideoFrame = ({ video, poster, title, boxClassName = '', hugClassName = '', hugChrome }: VideoFrameProps) => {
  const [measured, setMeasured] = useState<MeasuredFrame | null>(null);
  const frame = resolveFrame(video, measured);
  const style = frameStyle(frame);
  const hug = !frame.landscape;
  return (
    <div
      data-video-hug={hug || undefined}
      className={hug ? `${VIDEO_CAP_CLASS} mx-auto ${hugClassName}` : boxClassName}
      style={hugStyle(frame, hugChrome)}
    >
      <div className={hug ? 'w-full overflow-hidden' : 'w-full overflow-hidden bg-black'}>
        <div
          data-video-frame
          className={frame.landscape ? 'aspect-video w-full' : VIDEO_CAP_CLASS}
          style={style}
        >
          <VideoEmbed
            video={video}
            poster={poster}
            title={title}
            contain={!frame.landscape}
            onVideoSize={(w, h) =>
              video.kind === 'direct' && setMeasured({ src: video.src, shape: frameFor(w, h) })
            }
          />
        </div>
      </div>
    </div>
  );
};

export default VideoFrame;
