// ONE rule per link field the organiser screens take (ticket link, video
// links, the profile's Instagram, website and Facebook). The sheet that edits a
// link shows the problem inline and disables its Done with it; the Save that
// sends the link checks the SAME function, so a link the sheet accepts is never
// refused at Save and the other way round. Pure (no client import).
//
// The rules mirror the server, read with pg_get_functiondef (SELECT only) on
// 2026-10-08:
//  - _owner_public_url_ok_p5: blank, or after btrim an absolute http(s) URL with
//    no whitespace or control character, at most 2048 characters.
//  - _owner_instagram_url_ok_p5: that rule AND an instagram.com host with a path;
//    organiser_profile_update_p5_v1 also takes a bare handle ^@?[A-Za-z0-9._]{1,30}$.
//  - facebook in socials: a page name ^@?[A-Za-z0-9._-]{1,50}$ or a public URL.
// The profile save normalises the value first (withNormalizedProtocol), so the
// check runs on what is actually sent.

import { withNormalizedProtocol } from '@/lib/organiserProfileUpdate';

export type LinkKind = 'ticket' | 'video' | 'instagram' | 'website' | 'facebook';

const MAX_URL = 2048;
// eslint-disable-next-line no-control-regex
const PUBLIC_URL = /^https?:\/\/[^\s\u0000-\u001f\u007f]+$/i;
const INSTAGRAM_URL = /^https?:\/\/(www[.])?instagram[.]com\/\S*$/i;
const INSTAGRAM_HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;
const FACEBOOK_NAME = /^@?[A-Za-z0-9._-]{1,50}$/;

/** The server's public-link rule (_owner_public_url_ok_p5); blank passes. */
export const publicUrlOk = (value: string) => {
  const v = value.trim();
  return v === '' || (v.length <= MAX_URL && PUBLIC_URL.test(v));
};

export const LINK_PROBLEM: Record<LinkKind, string> = {
  ticket: 'Enter the ticket link as a full address starting with https://',
  video: 'Enter the video as a full address starting with https://',
  instagram: 'Enter your Instagram handle, like @ritmoleeds, or a link to your instagram.com page.',
  website: 'Enter your website as an address, like ritmo.example or https://ritmo.example',
  facebook: 'Enter your Facebook page name or a full https:// link.',
};

/** What is wrong with one link, in plain words; null when it can be saved. A blank link is fine (it clears). */
export function linkProblem(kind: LinkKind, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  let ok: boolean;
  switch (kind) {
    case 'ticket':
    case 'video':
      ok = publicUrlOk(v);
      break;
    case 'instagram': {
      const sent = withNormalizedProtocol(v, 'instagram.com');
      ok = INSTAGRAM_HANDLE.test(sent) || (publicUrlOk(sent) && INSTAGRAM_URL.test(sent));
      break;
    }
    case 'website':
      ok = publicUrlOk(withNormalizedProtocol(v));
      break;
    case 'facebook': {
      const sent = withNormalizedProtocol(v, 'facebook.com');
      ok = FACEBOOK_NAME.test(sent) || publicUrlOk(sent) && /^https?:\/\//i.test(sent);
      break;
    }
  }
  return ok ? null : LINK_PROBLEM[kind];
}
