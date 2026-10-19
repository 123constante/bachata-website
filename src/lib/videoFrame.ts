import type { CSSProperties } from 'react';

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

/** Inline style for the adaptive (non-landscape) frame; undefined for landscape. */
export const frameStyle = (frame: VideoFrameShape): CSSProperties | undefined =>
  frame.landscape
    ? undefined
    : {
        aspectRatio: `${frame.ratio}`,
        width: `min(100%, calc(75svh * ${frame.ratio}))`,
        marginInline: 'auto',
      };
