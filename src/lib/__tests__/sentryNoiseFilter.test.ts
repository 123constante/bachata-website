import { describe, it, expect } from 'vitest';
import { isInjectedThirdPartyEvent } from '@/lib/sentry';

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
