import { useState } from 'react';
import { VideoEmbed } from '@/components/VideoEmbed';
import type { VenueVideo } from '@/lib/parseVenueVideoUrl';
import { frameFor, frameStyle, resolveFrame, type MeasuredFrame } from '@/lib/videoFrame';

type VideoFrameProps = {
  video: VenueVideo;
  poster?: string | null;
  title: string;
};

/**
 * VideoFrame — owns the box around <VideoEmbed>. Landscape (and Vimeo / ordinary
 * YouTube) = 16:9. Direct clips are measured on loadedmetadata; YouTube Shorts
 * are portrait from the URL. Anything below LANDSCAPE_MIN_RATIO is shown whole,
 * centred on black, capped at 75svh (see src/lib/videoFrame.ts).
 */
export const VideoFrame = ({ video, poster, title }: VideoFrameProps) => {
  const [measured, setMeasured] = useState<MeasuredFrame | null>(null);
  const frame = resolveFrame(video, measured);
  const style = frameStyle(frame);
  return (
    <div className="w-full overflow-hidden bg-black">
      <div
        data-video-frame
        className={frame.landscape ? 'aspect-video w-full' : undefined}
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
  );
};

export default VideoFrame;
