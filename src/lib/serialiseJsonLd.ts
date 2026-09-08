/**
 * serialiseJsonLd -- JSON.stringify for a value about to be inlined into an
 * HTML <script type="application/ld+json"> tag.
 *
 * JSON.stringify escapes neither `<` nor `/`, so any string in the payload
 * containing `</script>` closes the tag early and the browser parses whatever
 * follows as HTML. On this site those strings are organiser-supplied -- an
 * event name reaches the homepage ItemList straight off `events.name` -- and
 * every one of these pages is server-rendered, so the injected markup would be
 * served to every visitor from our own origin.
 *
 * Escaping `<` is both necessary and sufficient here. It is a valid JSON
 * escape that parses back to the identical string, so every consumer
 * (Google's parser included) sees exactly the same data; and the only way out
 * of the tag is the HTML tokeniser meeting `</script`. U+2028/U+2029 are
 * deliberately NOT escaped: they break inline JavaScript SOURCE, and
 * application/ld+json is data the browser never evaluates.
 *
 * ONE owner for the rule. Every application/ld+json sink in the app routes
 * through here rather than calling JSON.stringify itself, so this file is the
 * only place the escaping can be got wrong -- or fixed.
 */
export const serialiseJsonLd = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');
