import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BENTO_SURFACE, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { VideoFrame } from '@/components/VideoFrame';
import type { VenueVideo } from '@/lib/parseVenueVideoUrl';

type VideoBlockProps = {
  video: VenueVideo;
  poster: string | null;
  title: string;
};

/**
 * VideoBlock — the dedicated event video tile. The cover stays the flyer/images;
 * this full-width tile plays the first playable video (YouTube/Vimeo/direct
 * upload) in an adaptive frame (16:9, or whole-and-centred for portrait) via <VideoFrame>,
 * which also draws the rounded inner box (it hugs a portrait video; the card
 * keeps its full-width grid slot and title). BentoPage hides the tile
 * entirely when there's no playable video, so this never renders empty.
 *
 * `multi-target` mode = the brass button-visual shell (matching other tiles)
 * rendered as a <div>, since the video owns its own inner tap targets
 * (play/mute, or the YouTube/Vimeo player) rather than being one tap target.
 */
export const VideoBlock = ({ video, poster, title }: VideoBlockProps) => (
  <BentoTile title={BLOCK_TITLES.video} color={BENTO_SURFACE} mode="multi-target">
    <VideoFrame
      video={video}
      poster={poster}
      title={title}
      boxClassName="overflow-hidden rounded-[14px]"
      hugClassName="overflow-hidden rounded-[14px]"
    />
  </BentoTile>
);

export default VideoBlock;
