// Shared source-text stripper for the script-side static guards.
//
// Blanks the CONTENT of // line comments, /* block */ comments and string
// literals (double, single, backtick) while preserving every newline, so a
// scanner built on top reports accurate 1-based line numbers and never claims
// a documentation example or a fixture string is a live call site.
//
// Extracted from scripts/audit-images.mjs (which has used it since the <img>
// alt/loading audit) when scripts/check-image-widths.mjs needed the same
// behaviour. It lives here rather than being re-implemented because a second,
// weaker copy of a scanner primitive is precisely the drift that let the
// original imageCdn no-op survive: two definitions of the same rule, only one
// of them maintained. Both guards run in the same architecture-guard job.
//
// Deliberately NOT stripped: JSX {/* ... */} comment braces (the surrounding
// /* */ still blanks their content) and regex literals. A full tokeniser is not
// worth the failure surface here -- but note WHY that is now safe, because the
// original wording ("neither has produced a false positive") was measured wrong
// on 2026-08-03. The risk was never a false positive; it was a false NEGATIVE.
// An unstripped regex literal containing a quote, like .replace(/"/g, "&quot;"),
// left an odd number of quotes on the line, and so did an apostrophe in JSX text
// (What's On Tonight). Either opened a phantom string that ran to the next
// matching quote ANYWHERE LATER IN THE FILE, silently blanking real code: 15 of
// the 531 files check-image-widths.mjs scans were partly invisible to it, and
// three <img> tags were invisible to audit-images.mjs, one of them genuinely
// missing loading=. The closesOnSameLine() rule below caps that damage at the
// single line the stray quote sits on. Guards fail open quietly; measure this
// one with a canary appended to each real file rather than trusting a clean run.
const BS = String.fromCharCode(92);
const BACKTICK = String.fromCharCode(96);

/**
 * Does the quote opened at `openIdx` close before the line ends?
 *
 * A ' or " literal cannot span a raw newline in JS/TS, so "no" means this was
 * never a string opener at all. A backslash-newline line continuation IS legal
 * and is skipped here, so a genuine continued string still answers yes.
 */
function closesOnSameLine(text, openIdx, quote) {
  for (let j = openIdx + 1; j < text.length; j += 1) {
    const ch = text[j];
    if (ch === BS) { j += 1; continue; }
    if (ch === '\n') return false;
    if (ch === quote) return true;
  }
  return false;
}

export function stripCommentsAndStrings(text) {
  // Replace contents of // line comments, /* block */ comments, and string
  // literals (" ' `) with spaces, preserving line breaks so line numbers
  // remain accurate. Does NOT strip JSX {/* */} content (those are JSX
  // comments and unlikely to contain <img references; left as-is).
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const c2 = text[i + 1] || '';
    if (c === '/' && c2 === '/') {
      // line comment
      while (i < text.length && text[i] !== '\n') {
        out += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
    } else if (c === '/' && c2 === '*') {
      out += '  ';
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < text.length) { out += '  '; i += 2; }
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      // NOT EVERY QUOTE OPENS A STRING. An apostrophe in JSX text (What's On
      // Tonight, beginners' courses) and a quote inside a regex literal
      // (.replace(/"/g, "&quot;")) both used to open a phantom string that ran
      // to the next matching quote ANYWHERE LATER IN THE FILE, blanking real
      // code on the way. Measured 2026-08-03 on this tree: 15 of 531 scanned
      // files were partly invisible to check-image-widths.mjs -- a guard
      // failing open, which is the one failure mode these scanners exist to
      // remove. A ' or " literal cannot span a raw newline, so when the closing
      // quote does not arrive before the line ends this was never a string:
      // emit the character and carry on. Backticks are exempt -- template
      // literals legitimately span lines. This only ever blanks LESS than
      // before, so it can never hide a call site; the residual mis-pairing is
      // confined to the single line the stray quote sits on.
      if (quote !== BACKTICK && !closesOnSameLine(text, i, quote)) {
        out += c;
        i += 1;
        continue;
      }
      out += ' ';
      i += 1;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === BS && i + 1 < text.length) {
          // Preserve a line continuation's newline, or every line number
          // reported after it shifts by one.
          out += ' ';
          out += text[i + 1] === '\n' ? '\n' : ' ';
          i += 2;
          continue;
        }
        out += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < text.length) { out += ' '; i += 1; }
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}
