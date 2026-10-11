// Edit in place: the bottom sheet for ONE field. Done only changes the local
// draft (the page's single Save sends it); for the photo, Done uploads the
// picture first so the draft holds its public URL.
//
// Keyboard: the sheet is positioned against window.visualViewport so it stays
// ABOVE the phone keyboard with Done visible (bottom = innerHeight - vv.height
// - vv.offsetTop, max-height = vv.height - 12px, scrolling inside), inputs are
// 16px (no iOS zoom), safe-area padding at the bottom. It is a modal dialog:
// focus moves into the field on open, Tab is trapped inside, Escape and the
// overlay close it, and the caller returns focus to the pencil.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useKeyboardInset } from '@/modules/organiser/ui/useKeyboardInset';
import {
  ABOUT_MAX,
  CATEGORY_OPTIONS,
  FIELD_LABEL,
  aboutLength,
  checkField,
  type FieldKey,
} from './fieldRules';
import { PHOTO_ACCEPT } from './organiserPhotoModel';
import { PUBLIC_LINK_REL } from '@/lib/organiserLinkLabels';
import { inBody } from './layers';
import { CREAM, GOLD, INK } from './parts';

export interface FieldSheetProps {
  field: FieldKey;
  /** What the sheet opens with: the draft if there is one, else the stored value. */
  initial: string;
  storedCategory: string | null;
  onDone: (value: string) => void;
  onClose: () => void;
  /** Photo only: uploads the picked file and resolves its public URL (throws plain copy). */
  uploadPhoto: (file: File) => Promise<string>;
}

const PLACEHOLDER: Partial<Record<FieldKey, string>> = {
  founded_year: 'e.g. 2019',
  instagram: '@yourname',
  website: 'yourschool.com',
  facebook: 'Your page name or facebook.com link',
};
const HELP: Partial<Record<FieldKey, string>> = {
  founded_year: 'The year you started running nights or classes.',
  instagram: 'Your Instagram name, like @yourname, or a link to your profile.',
  website: 'Your own website, if you have one.',
  facebook: 'Your Facebook page name, or the link from your page.',
  organisation_category: 'What best describes you.',
  bio: 'Shown as plain text on your page.',
};
const LINK_FIELDS = new Set<FieldKey>(['instagram', 'website', 'facebook']);

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontSize: 16, lineHeight: 1.4, padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(246,241,234,0.25)', background: 'rgba(246,241,234,0.06)', color: CREAM,
};
const btn: CSSProperties = { minHeight: 44, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer' };

export default function FieldSheet({ field, initial, storedCategory, onDone, onClose, uploadPhoto }: FieldSheetProps) {
  const titleId = useId();
  const helpId = useId();
  const errorId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLElement | null>(null);
  const { inset, height } = useKeyboardInset(true);
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  // Photo
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const check = useMemo(() => checkField(field, value, { storedCategory }), [field, value, storedCategory]);
  const label = FIELD_LABEL[field];

  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!uploading) onClose();
      return;
    }
    if (e.key !== 'Tab' || !sheetRef.current) return;
    const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const done = async () => {
    if (field === 'avatar_url') {
      if (file) {
        setUploading(true);
        setPhotoError(null);
        try {
          const url = await uploadPhoto(file);
          onDone(url);
        } catch (e) {
          setPhotoError(e instanceof Error ? e.message : 'The photo did not upload. Try again.');
        } finally {
          setUploading(false);
        }
        return;
      }
      if (removed) onDone('');
      else onClose();
      return;
    }
    setTouched(true);
    if (!check.ok) return;
    onDone(check.value);
  };

  const showError = (touched || value !== initial) && !check.ok && check.error;
  const doneDisabled = uploading || (field !== 'avatar_url' && !check.ok);

  const describedBy = [HELP[field] ? helpId : null, showError ? errorId : null].filter(Boolean).join(' ') || undefined;

  let body: JSX.Element;
  if (field === 'bio') {
    const n = aboutLength(value);
    body = (
      <>
        <textarea
          id={`${titleId}-input`}
          ref={(el) => { firstRef.current = el; }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          aria-describedby={describedBy}
          aria-invalid={!!showError}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
        />
        <p aria-live="polite" style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'right', color: n > ABOUT_MAX ? '#FF8A70' : 'rgba(246,241,234,0.6)' }} data-testid="eip-about-counter">
          {n} / {ABOUT_MAX}
        </p>
      </>
    );
  } else if (field === 'organisation_category') {
    const opts = [...CATEGORY_OPTIONS] as string[];
    if (storedCategory && !opts.includes(storedCategory)) opts.push(storedCategory);
    body = (
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }} aria-describedby={describedBy}>
        <legend className="sr-only">{label}</legend>
        {[...opts, ''].map((o, i) => (
          <label key={o || 'none'} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 16, color: CREAM, cursor: 'pointer' }}>
            <input
              type="radio"
              name={`${titleId}-cat`}
              value={o}
              checked={value === o}
              onChange={() => setValue(o)}
              ref={(el) => { if (i === 0 || value === o) firstRef.current = el; }}
              style={{ width: 20, height: 20, accentColor: GOLD }}
            />
            {o || 'None'}
          </label>
        ))}
      </fieldset>
    );
  } else if (field === 'avatar_url') {
    const shown = preview ?? (removed ? null : initial || null);
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'rgba(246,241,234,0.08)', flexShrink: 0 }}>
            {shown && <img src={shown} alt="" loading="eager" width={72} height={72} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="eip-file" style={{ ...btn, position: 'relative', display: 'inline-flex', alignItems: 'center', background: GOLD, color: INK, border: 'none' }}>
              {shown ? 'Choose a new photo' : 'Choose a photo'}
              <input
                type="file"
                accept={PHOTO_ACCEPT}
                ref={(el) => { firstRef.current = el; }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPhotoError(null);
                  setFile(f);
                  setRemoved(false);
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
                aria-describedby={photoError ? errorId : undefined}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
              />
            </label>
            {(initial || file) && !removed && (
              <button type="button" onClick={() => { setFile(null); setPreview(null); setRemoved(true); }} style={{ ...btn, background: 'none', border: '1px solid rgba(246,241,234,0.25)', color: CREAM }}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'rgba(246,241,234,0.6)' }}>JPEG, PNG or WebP. We make it smaller before it uploads.</p>
        {uploading && <p role="status" style={{ margin: '6px 0 0', fontSize: 13, color: GOLD }}>Uploading your photo&hellip;</p>}
        {photoError && <p id={errorId} role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#FF8A70' }}>{photoError}</p>}
      </>
    );
  } else {
    body = (
      <input
        id={`${titleId}-input`}
        ref={(el) => { firstRef.current = el; }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void done(); } }}
        placeholder={PLACEHOLDER[field]}
        inputMode={field === 'founded_year' ? 'numeric' : field === 'website' ? 'url' : undefined}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={describedBy}
        aria-invalid={!!showError}
        style={inputStyle}
      />
    );
  }

  const sheetStyle: CSSProperties = {
    position: 'fixed', left: 0, right: 0, bottom: inset, zIndex: 61,
    maxHeight: height ? Math.max(160, height - 12) : '85vh', overflowY: 'auto', boxSizing: 'border-box',
    background: '#17131A', color: CREAM, borderRadius: '16px 16px 0 0', borderTop: `1px solid rgba(231,190,110,0.35)`,
    padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto',
  };

  // In document.body (see layers.tsx), so no page ancestor can re-anchor it.
  return inBody(
    <>
      <div aria-hidden="true" data-testid="eip-sheet-overlay" onClick={() => { if (!uploading) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)' }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} style={sheetStyle} data-testid="eip-sheet">
        <h2 id={titleId} style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
          <label htmlFor={field === 'organisation_category' || field === 'avatar_url' ? undefined : `${titleId}-input`}>{label}</label>
        </h2>
        {HELP[field] && <p id={helpId} style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(246,241,234,0.7)' }}>{HELP[field]}</p>}
        {body}
        {showError && <p id={errorId} role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#FF8A70' }}>{check.error}</p>}
        {LINK_FIELDS.has(field) && check.ok && check.willSave && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <p style={{ margin: 0, display: 'flex', gap: 4, minWidth: 0 }} data-testid="eip-will-save">
              <span style={{ flexShrink: 0, color: 'rgba(246,241,234,0.7)' }}>We will save:</span>
              <span title={check.willSave} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{check.willSave}</span>
            </p>
            {check.hints.map((h) => <p key={h} style={{ margin: '4px 0 0', color: GOLD }} data-testid="eip-hint">{h}</p>)}
            {check.href && (
              <a href={check.href} target="_blank" rel={PUBLIC_LINK_REL} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: GOLD, fontWeight: 700 }}>
                Open the link to check it
              </a>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose} disabled={uploading} style={{ ...btn, background: 'none', border: '1px solid rgba(246,241,234,0.25)', color: CREAM }}>
            Cancel
          </button>
          <button type="button" onClick={() => void done()} disabled={doneDisabled} aria-disabled={doneDisabled} style={{ ...btn, background: GOLD, color: INK, border: 'none', opacity: doneDisabled ? 0.5 : 1 }}>
            {uploading ? 'Uploading\u2026' : 'Done'}
          </button>
        </div>
      </div>
    </>,
  );
}
