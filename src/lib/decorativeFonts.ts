// Decorative Google Fonts (Cormorant/Manrope/Bebas/etc.) are not needed for
// first paint, so they are injected after the window `load` event.
//
// The readyState branch is load-bearing: entry.client runs AFTER `load` has
// already fired on light routes (measured on prod 2026-10-02: /parties and
// /classes registered the listener at readyState "complete"), and a `load`
// listener added then never fires -- every Cormorant/Manrope use silently fell
// back to Georgia/Inter on those routes.

export const DECORATIVE_FONTS_HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600" +
  "&family=Manrope:wght@400;500;600;700;800" +
  "&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700" +
  "&family=JetBrains+Mono:wght@400;500;700" +
  "&family=Bebas+Neue" +
  "&family=Archivo+Black" +
  "&family=Big+Shoulders+Display:wght@700;800;900" +
  "&display=swap";

type FontDoc = Pick<Document, "readyState" | "createElement" | "head" | "querySelector">;
type FontWin = Pick<Window, "addEventListener">;

export function scheduleDecorativeFonts(doc: FontDoc = document, win: FontWin = window): void {
  const inject = () => {
    if (doc.querySelector(`link[href="${DECORATIVE_FONTS_HREF}"]`)) return;
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = DECORATIVE_FONTS_HREF;
    doc.head.appendChild(link);
  };
  if (doc.readyState === "complete") inject();
  else win.addEventListener("load", inject, { once: true });
}
