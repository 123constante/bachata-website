import { useState } from 'react';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';

const E = V2.every;

/** SH-NAME: the event name. Empty = error and stays open; unchanged = closes with no save; else `onSave(name)`. */
export function NameSheet({ current, day, onSave, onClose }: {
  current: string; day: string; onSave: (name: string) => void | Promise<unknown>; onClose: () => void;
}) {
  const [text, setText] = useState(current);
  const [problem, setProblem] = useState(false);
  const done = () => {
    const v = text.trim();
    if (!v) { setProblem(true); return; }
    if (v === current.trim()) { onClose(); return; }
    void onSave(v);
  };
  return (
    <V2Sheet open title={E.name} onClose={onClose}>
      <div className="grp">
        <label className="flab" htmlFor="nm-t">{E.nameField}</label>
        <input id="nm-t" type="text" className="fld" autoComplete="off" value={text} onChange={(e) => { setText(e.target.value); setProblem(false); }} />
        <p className="hint">{E.nameHint(day)}</p>
        {problem && <p className="err" role="alert" data-testid="name-error">{E.nameError}</p>}
        <button type="button" className="btn pri" data-testid="name-done" onClick={done}>{E.nameDone}</button>
      </div>
    </V2Sheet>
  );
}
