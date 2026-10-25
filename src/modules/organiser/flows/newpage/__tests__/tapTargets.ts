/** Every control in `root` declares a height of at least 44px (explicit px; the site's rem renders small on phones). */
export function smallControls(root: HTMLElement): string[] {
  const controls = Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="checkbox"]), textarea, select'));
  return controls
    .filter((el) => {
      const own = (el.getAttribute('class') ?? '').match(/(?:^|\s)(?:min-)?h-\[(\d+)px\]/g) ?? [];
      const parent = (el.parentElement?.getAttribute('class') ?? '').match(/(?:^|\s)(?:min-)?h-\[(\d+)px\]/g) ?? [];
      const px = [...own, ...parent].map((m) => Number(/(\d+)px/.exec(m)?.[1]));
      return !px.some((n) => n >= 44);
    })
    .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? ''}]`);
}
