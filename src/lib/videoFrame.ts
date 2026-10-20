import { useEffect, type CSSProperties, type RefObject } from 'react';

/** A direct clip at or above this width/height ratio keeps the 16:9 box. */
export const LANDSCAPE_MIN_RATIO = 1.6;

export type VideoFrameShape = { landscape: boolean; ratio: number };

const FALLBACK: VideoFrameShape = { landscape: true, ratio: 16 / 9 };

/** Classify a measured clip size. Missing/zero/non-finite sizes stay landscape. */
export const frameFor = (width?: number, height?: number): VideoFrameShape => {
  if (
    typeof width !== 'number' || typeof height !== 'number' ||
    !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
  ) {
    return FALLBACK;
  }
  const ratio = width / height;
  return { landscape: ratio >= LANDSCAPE_MIN_RATIO, ratio };
};

/**
 * Sets --video-cap on the adaptive frame: 55svh on phones, 75svh from the md
 * breakpoint (768px, Tailwind default) up. Landscape frames do not use it.
 */
export const VIDEO_CAP_CLASS = '[--video-cap:55svh] md:[--video-cap:75svh]';

/** Inline style for the adaptive (non-landscape) frame; undefined for landscape. */
export const frameStyle = (frame: VideoFrameShape): CSSProperties | undefined =>
  frame.landscape
    ? undefined
    : {
        aspectRatio: `${frame.ratio}`,
        width: `min(100%, calc(var(--video-cap) * ${frame.ratio}))`,
        marginInline: 'auto',
      };

/** A shape measured from one specific direct clip. */
export type MeasuredFrame = { src: string; shape: VideoFrameShape };

/**
 * The frame for the video on screen. A measurement only applies to the clip it
 * came from, so a reused component never carries clip A's shape onto clip B.
 */
export const resolveFrame = (
  video: { kind: string; src?: string; portrait?: boolean },
  measured: MeasuredFrame | null,
): VideoFrameShape => {
  if (video.kind === 'youtube' && video.portrait) return frameFor(9, 16);
  if (video.kind === 'direct' && measured && measured.src === video.src) return measured.shape;
  return frameFor();
};

/**
 * Report the size of a clip whose metadata loaded BEFORE React hydrated (the
 * server-rendered <video> fires loadedmetadata before onLoadedMetadata is
 * attached, so that handler never runs). Runs once per src.
 */
export const useReportVideoSize = (
  ref: RefObject<HTMLVideoElement | null>,
  src: string | undefined,
  report: (w: number, h: number) => void,
) => {
  useEffect(() => {
    const v = ref.current;
    if (v && v.readyState >= 1 && v.videoWidth > 0) report(v.videoWidth, v.videoHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
};
