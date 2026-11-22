import { useState } from 'react';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';
import { NIGHT_ABOUT_MAX } from './editorModel';
import type { SheetMode } from './WhereSheet';

const W = V2.whereAbout;

/** What Done sends: undefined = nothing to save, null = clear the night's own text, string = save it. */
export function aboutToSave(text: string, current: string, usual: string | null | undefined): string | null | undefined {
  if (text === current) return undefined;
  if (text === (usual ?? '')) return null;
  return text;
}

/**
 * SH-ABOUT: the description text box. Controlled: `current` is the text shown now, `usual` the series text,
 * `onSave(value)` the caller's write (null = go back to the usual text).
 */
export function AboutSheet({ current, usual, mode, dateWords, changed, onSave, onBack, onClose }: {
  current: string; usual?: string | null; mode: SheetMode; dateWords: string; changed?: boolean;
  onSave: (value: string | null) => void | Promise<unknown>; onBack?: () => void | Promise<unknown>; onClose: () => void;
}) {
  const [text, setText] = useState(current);
  const [problem, setProblem] = useState<string | null>(null);
  const done = () => {
    if (text.length > NIGHT_ABOUT_MAX) { setProblem(W.tooLong(NIGHT_ABOUT_MAX)); return; }
    const v = aboutToSave(text, current, usual);
    if (v === undefined) { onClose(); return; }
    void onSave(v);
  };
  return (
    <V2Sheet open title={V2.description} onClose={onClose}>
      <div className="grp">
        <label className="flab" htmlFor="ab-t">{mode === 'night' ? W.readOnly(dateWords) : W.read}</label>
        <textarea id="ab-t" className="fld" rows={5} placeholder={W.aboutPlaceholder} value={text} onChange={(e) => { setText(e.target.value); setProblem(null); }} />
        {problem && <p className="err" role="alert" data-testid="about-problem">{problem}</p>}
        <button type="button" className="btn pri" onClick={done}>{W.done}</button>
        {mode === 'night' && changed && onBack && (
          <button type="button" className="btn sec" data-testid="about-back" onClick={() => { void onBack(); onClose(); }}>{W.backToUsualAbout}</button>
        )}
      </div>
    </V2Sheet>
  );
}
