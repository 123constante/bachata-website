import { useState } from 'react';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';

const E = V2.every;

/** SH-MUSIC: the usual music styles. Unchanged = closes with no save; else `onSave(list)` (chip order, then any stored extras). */
export function MusicSheet({ current, onSave, onClose }: {
  current: string[]; onSave: (styles: string[]) => void | Promise<unknown>; onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(current);
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const done = () => {
    const next = [...E.musicChips.filter((c) => picked.includes(c)), ...picked.filter((x) => !E.musicChips.includes(x))];
    const same = next.length === current.length && next.every((c) => current.includes(c));
    if (same) { onClose(); return; }
    void onSave(next);
  };
  return (
    <V2Sheet open title={E.music} onClose={onClose}>
      <div className="grp">
        <div className="chipsw">
          {E.musicChips.map((c) => (
            <button type="button" key={c} className={picked.includes(c) ? 'tchip on' : 'tchip'} aria-pressed={picked.includes(c)} onClick={() => toggle(c)}>{c}</button>
          ))}
        </div>
        <button type="button" className="btn pri" data-testid="music-done" onClick={done}>{E.musicDone}</button>
      </div>
    </V2Sheet>
  );
}
