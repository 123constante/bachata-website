import { useEffect, useState } from 'react';

import { useCoverCarousel } from '@/modules/event-page/bento/hooks/useCoverCarousel';

// Per-slide dwell for the festival Stories cover. Matches sample 08's DUR
// (3.6s) -- the progress-bar fill animation runs over the same window so it
// completes exactly as the carousel advances to the next slide.
const STORY_ADVANCE_MS = 3600;

type FestivalStoriesCoverProps = {
  // Ordered image list -- poster first, then gallery (already deduped by the
  // caller). Slide 0 is treated as the cover for alt text + eager loading.
  images: string[];
  title: string;
  // Opens the festival flyer lightbox at the given index (center tap zone).
  onExpand: (index: number) => void;
  // Hard pause from the parent (e.g. the flyer lightbox is open).
  paused?: boolean;
};

// Tracks prefers-reduced-motion and re-renders if the OS setting changes.
const usePrefersReducedMotion = (): boolean => {
  const [prefers, setPrefers] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return prefers;
};

const ExpandIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

// Sample 08 "Stories" cover for the festival hero: a 16:9 card cycling the
// poster + gallery images with segmented progress bars, a 0.6s crossfade and
// 3.6s auto-advance. Tap the left/right thirds to step, the centre to expand
// into the existing flyer lightbox. Hover pauses (desktop); reduced-motion
// disables rotation entirely. Styling lives in FestivalDetail's CINEMATIC_CSS
// (scoped under .cinematic-festival .story).
export const FestivalStoriesCover = ({
  images,
  title,
  onExpand,
  paused = false,
}: FestivalStoriesCoverProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);

  const { index, sessionId, advance, goTo } = useCoverCarousel({
    count: images.length,
    paused: paused || hovered,
    disabled: prefersReducedMotion,
    advanceMs: STORY_ADVANCE_MS,
  });

  if (images.length === 0) return null;

  const multi = images.length > 1;
  const animationPaused = paused || hovered;

  return (
    <div className="story-cover">
      <div
        className="story"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {images.map((url, i) => (
          <div
            key={url}
            className={i === index ? 'photo on' : 'photo'}
            aria-hidden={i !== index}
          >
            <img
              src={url}
              alt={i === 0 ? title : ''}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </div>
        ))}

        {multi && (
          <div className="bars" aria-hidden="true">
            {images.map((_, i) => {
              const isCompleted = i < index;
              const isActive = i === index;
              return (
                <div key={i} className="bar">
                  <i
                    key={isActive ? `active-${sessionId}` : `static-${i}`}
                    style={{
                      transform: isCompleted ? 'scaleX(1)' : 'scaleX(0)',
                      animation:
                        isActive && !prefersReducedMotion
                          ? `festival-story-progress ${STORY_ADVANCE_MS}ms linear forwards`
                          : undefined,
                      animationPlayState: animationPaused ? 'paused' : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {multi ? (
          <>
            <button
              type="button"
              className="zone l"
              aria-label="Previous image"
              onClick={() => goTo(index - 1)}
            />
            <button
              type="button"
              className="center"
              aria-label="Expand image full-screen"
              onClick={() => onExpand(index)}
            />
            <button
              type="button"
              className="zone r"
              aria-label="Next image"
              onClick={advance}
            />
          </>
        ) : (
          <button
            type="button"
            className="center"
            style={{ inset: 0 }}
            aria-label="Expand image full-screen"
            onClick={() => onExpand(0)}
          />
        )}

        <div className="aff" aria-hidden="true">
          <ExpandIcon />
          <span>Tap to expand</span>
        </div>
      </div>
    </div>
  );
};
