// Home-page announcement banner. Ships OFF; flip this one constant to launch
// the "all dancers" wave. OFF renders nothing and changes no layout.
export const HOME_ANNOUNCE_BANNER_ON = false;

export const HOME_ANNOUNCE_TEXT = 'New: dancer profiles + organiser pages';
export const HOME_ANNOUNCE_CTA = 'Create your profile';
// Existing dancer sign-up (Auth.tsx reads `mode` and `userType`).
export const HOME_ANNOUNCE_HREF = '/auth?mode=signup&userType=dancer';
export const HOME_ANNOUNCE_STORAGE_KEY = 'home-announce-dismissed-v1';
