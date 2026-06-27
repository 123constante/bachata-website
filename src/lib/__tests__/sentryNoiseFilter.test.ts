import { describe, it, expect } from 'vitest';
import { isInjectedThirdPartyEvent, isStaleChunkEvent } from '@/lib/sentry';

// The discriminator is keyed off the verified shapes of real production events
// (fetched from the Sentry API): injected Chrome-iOS scripts carry frames whose
// file location is literally "undefined", while our own bundle errors always
// point at an /assets/*.js chunk (or a resolved .tsx source). `in_app` is true
// for BOTH, so it is deliberately NOT used here.

describe('isInjectedThirdPartyEvent', () => {
  it('drops an injected-script event (BACHATA-WEBSITE-N: single "undefined" frame)', () => {
    const event = {
      exception: {
        values: [
          {
            type: 'RangeError',
            stacktrace: { frames: [{ filename: 'undefined', abs_path: 'undefined' }] },
          },
        ],
      },
    };
    expect(isInjectedThirdPartyEvent(event)).toBe(true);
  });

  it('keeps a real error with minified /assets frames (BACHATA-WEBSITE-2C)', () => {
    const event = {
      exception: {
        values: [
          {
            type: 'TypeError',
            stacktrace: {
              frames: [
                { filename: '/assets/index-GmrCML6B.js', abs_path: 'https://www.bachatacalendar.co.uk/assets/index-GmrCML6B.js' },
                { filename: '/assets/vendor-map-D3ZEPz02.js', abs_path: 'https://www.bachatacalendar.co.uk/assets/vendor-map-D3ZEPz02.js' },
              ],
            },
          },
        ],
      },
    };
    expect(isInjectedThirdPartyEvent(event)).toBe(false);
  });

  it('keeps a real error once sourcemaps resolve to .tsx source', () => {
    const event = {
      exception: {
        values: [{ stacktrace: { frames: [{ filename: 'src/modules/home-map/EventMap.tsx', abs_path: 'app:///src/modules/home-map/EventMap.tsx' }] } }],
      },
    };
    expect(isInjectedThirdPartyEvent(event)).toBe(false);
  });

  it('keeps an event whose frames are a mix of junk and real source', () => {
    const event = {
      exception: {
        values: [
          { stacktrace: { frames: [{ filename: 'undefined' }, { filename: '/assets/index-abc.js' }] } },
        ],
      },
    };
    expect(isInjectedThirdPartyEvent(event)).toBe(false);
  });

  it('does NOT drop a message-only / frameless event', () => {
    expect(isInjectedThirdPartyEvent({})).toBe(false);
    expect(isInjectedThirdPartyEvent({ exception: { values: [] } })).toBe(false);
    expect(isInjectedThirdPartyEvent({ exception: { values: [{ stacktrace: { frames: [] } }] } })).toBe(false);
  });

  it('treats <anonymous> / native / empty locations as junk too', () => {
    const event = {
      exception: {
        values: [{ stacktrace: { frames: [{ filename: '<anonymous>' }, { abs_path: '[native code]' }, { filename: '' }] } }],
      },
    };
    expect(isInjectedThirdPartyEvent(event)).toBe(true);
  });
});

// Stale-deploy chunk-load failures (BACHATA-WEBSITE-7/-2J/-11/-3). These are
// handled by lazyWithRetry + ErrorBoundary (0 users impacted); the residual
// events are post-reload stragglers and global-handler captures. The classifier
// reuses STALE_CHUNK_RE from staleChunk.ts, matched against the originalException
// hint, the serialized exception value, or the event message.
describe('isStaleChunkEvent', () => {
  it('drops a stale-deploy module-script failure (BACHATA-WEBSITE-7)', () => {
    const event = {
      exception: { values: [{ type: 'TypeError', value: 'Importing a module script failed.' }] },
    };
    expect(isStaleChunkEvent(event)).toBe(true);
  });

  it('drops a CSS-preload failure via the originalException hint (BACHATA-WEBSITE-2J)', () => {
    const event = { exception: { values: [{ type: 'Error', value: 'opaque minified message' }] } };
    const hint = { originalException: new Error('Unable to preload CSS for /assets/EventPage-DWjty1L2.css') };
    expect(isStaleChunkEvent(event, hint)).toBe(true);
  });

  it('drops a "Failed to fetch dynamically imported module" event (BACHATA-WEBSITE-3)', () => {
    const event = {
      message: 'Failed to fetch dynamically imported module: https://www.bachatacalendar.co.uk/assets/MobileMapHome-x.js',
    };
    expect(isStaleChunkEvent(event)).toBe(true);
  });

  it('keeps a real application error', () => {
    const event = {
      exception: { values: [{ type: 'TypeError', value: "Cannot read properties of null (reading 'target')" }] },
    };
    expect(isStaleChunkEvent(event)).toBe(false);
  });

  it('does NOT drop a frameless / empty event', () => {
    expect(isStaleChunkEvent({})).toBe(false);
    expect(isStaleChunkEvent({ exception: { values: [] } })).toBe(false);
  });
});
