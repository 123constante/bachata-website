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
//
// City is a pick from the list (CitySheetBody.tsx): for it the sheet is a column
// whose list is the part that scrolls, so the search box stays at the top above
// the keyboard.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useKeyboardInset } from '@/modules/organiser/ui/useKeyboardInset';
import {
  ABOUT_MAX,
  CATEGORY_OPTIONS,
  FIELD_LABEL,
  NAME_MAX,
  aboutLength,
  checkField,
  nameLength,
  type FieldKey,
} from './fieldRules';
import CitySheetBody from './CitySheetBody';
import { useCityCheck, type CityLookups } from './cityCheck';
import { PHOTO_ACCEPT } from './organiserPhotoModel';
import { PUBLIC_LINK_REL } from '@/lib/organiserLinkLabels';
import { inBody } from './layers';
import { CREAM, GOLD, INK } from './parts';
import { FOCUSABLE, btn, inputStyle } from './sheetStyles';

export interface FieldSheetProps {
  field: FieldKey;
  /** What the sheet opens with: the draft if there is one, else the stored value. */
  initial: string;
  storedCategory: string | null;
  /** City only: the name of the city the sheet opens with. */
  initialCityName?: string | null;
  /** The server refused this field's value on the last Save (a taken name): shown while the box still holds that value. */
  serverError?: { value: string; message: string } | null;
  /** `label`: City only, the picked city's confirmed name. */
  onDone: (value: string, label?: string) => void;
  onClose: () => void;
  /** Photo only: uploads the picked file and resolves its public URL (throws plain copy). */
  uploadPhoto: (file: File) => Promise<string>;
  /** City only: the list search and the confirm-by-id lookup. */
  cityLookups: CityLookups;
}

const PLACEHOLDER: Partial<Record<FieldKey, string>> = {
  name: 'e.g. Ritmo Latino',
  founded_year: 'e.g. 2019',
  instagram: '@yourname',
  website: 'yourschool.com',
  facebook: 'Your page name or facebook.com link',
};
const HELP: Partial<Record<FieldKey, string>> = {
  name: 'The name dancers see at the top of your page. Your page link stays the same.',
  city: 'Where you run your nights. Search, then pick your city from the list.',
  founded_year: 'The year you started running nights or classes.',
  instagram: 'Your Instagram name, like @yourname, or a link to your profile.',
  website: 'Your own website, if you have one.',
  facebook: 'Your Facebook page name, or the link from your page.',
  organisation_category: 'What best describes you.',
  bio: 'Shown as plain text on your page.',
};
// Fields whose sheet shows "We will save" (City shows its own, from the confirmed city).
const PREVIEW_FIELDS = new Set<FieldKey>(['name', 'instagram', 'website', 'facebook']);
const LINK_FIELDS = new Set<FieldKey>(['instagram', 'website', 'facebook']);


export default function FieldSheet({ field, initial, storedCategory, initialCityName = null, serverError = null, onDone, onClose, uploadPhoto, cityLookups }: FieldSheetProps) {
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
  // City: the pick confirmed against the cities table ('none' for every other field).
  const city = useCityCheck(field === 'city' && value !== initial ? value : '', cityLookups.resolveCity);
  const cityChanged = field === 'city' && value !== initial;

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
    if (field === 'city') {
      if (!cityChanged) onDone(initial, initialCityName ?? undefined);
      else if (city.state === 'ok') onDone(city.city.cityId, city.city.cityName);
      return;
    }
    setTouched(true);
    if (!check.ok) return;
    onDone(check.value);
  };

  const serverSays = serverError && value.trim() === serverError.value.trim() ? serverError.message : null;
  const cityError = city.state === 'refused' ? city.message : null;
  const showError = field === 'city'
    ? cityError ?? serverSays
    : ((touched || value !== initial) && !check.ok && check.error) || serverSays;
  const doneDisabled = uploading
    || (field === 'city' ? cityChanged && city.state !== 'ok' : field !== 'avatar_url' && !check.ok);

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
  } else if (field === 'city') {
    body = (
      <CitySheetBody
        value={value}
        currentName={initialCityName}
        onPick={setValue}
        searchCities={cityLookups.searchCities}
        inputStyle={inputStyle}
        inputRef={(el) => { firstRef.current = el; }}
        describedBy={describedBy}
        labelledBy={titleId}
      />
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
        enterKeyHint="done"
        autoCapitalize={field === 'name' ? 'words' : 'none'}
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={describedBy}
        aria-invalid={!!showError}
        style={inputStyle}
      />
    );
    if (field === 'name') {
      const n = nameLength(value);
      body = (
        <>
          {body}
          <p aria-live="polite" style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'right', color: n > NAME_MAX ? '#FF8A70' : 'rgba(246,241,234,0.6)' }} data-testid="eip-name-counter">
            {n} / {NAME_MAX}
          </p>
        </>
      );
    }
  }

  const sheetStyle: CSSProperties = {
    position: 'fixed', left: 0, right: 0, bottom: inset, zIndex: 61,
    maxHeight: height ? Math.max(160, height - 12) : '85vh', overflowY: 'auto', boxSizing: 'border-box',
    // City: a column whose list (flex 1, min-height 0) is the part that scrolls.
    ...(field === 'city' ? { display: 'flex', flexDirection: 'column' as const } : null),
    background: '#17131A', color: CREAM, borderRadius: '16px 16px 0 0', borderTop: `1px solid rgba(231,190,110,0.35)`,
    padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto',
  };

  // In document.body (see layers.tsx), so no page ancestor can re-anchor it.
  return inBody(
    <>
      <div aria-hidden="true" data-testid="eip-sheet-overlay" onClick={() => { if (!uploading) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)' }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} style={sheetStyle} data-testid="eip-sheet">
        <h2 id={titleId} style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
          <label htmlFor={field === 'organisation_category' || field === 'avatar_url' || field === 'city' ? undefined : `${titleId}-input`}>{label}</label>
        </h2>
        {HELP[field] && <p id={helpId} style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(246,241,234,0.7)' }}>{HELP[field]}</p>}
        {body}
        {showError && <p id={errorId} role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#FF8A70', flexShrink: 0 }}>{showError}</p>}
        {field === 'city' && city.state === 'refused' && city.retry && (
          <button type="button" onClick={city.retry} style={{ ...btn, alignSelf: 'flex-start', marginTop: 6, background: 'none', border: '1px solid rgba(246,241,234,0.25)', color: CREAM, flexShrink: 0 }}>
            Check again
          </button>
        )}
        {field === 'city' && cityChanged && city.state === 'checking' && (
          <p role="status" style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(246,241,234,0.7)', flexShrink: 0 }}>Checking the city&hellip;</p>
        )}
        {field === 'city' && city.state === 'ok' && (
          <p style={{ margin: '8px 0 0', fontSize: 13, display: 'flex', gap: 4, minWidth: 0, flexShrink: 0 }} data-testid="eip-will-save">
            <span style={{ flexShrink: 0, color: 'rgba(246,241,234,0.7)' }}>We will save:</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city.city.cityName}</span>
          </p>
        )}
        {PREVIEW_FIELDS.has(field) && check.ok && check.willSave && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <p style={{ margin: 0, display: 'flex', gap: 4, minWidth: 0 }} data-testid="eip-will-save">
              <span style={{ flexShrink: 0, color: 'rgba(246,241,234,0.7)' }}>We will save:</span>
              <span title={check.willSave} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{check.willSave}</span>
            </p>
            {check.hints.map((h) => <p key={h} style={{ margin: '4px 0 0', color: GOLD }} data-testid="eip-hint">{h}</p>)}
            {LINK_FIELDS.has(field) && check.href && (
              <a href={check.href} target="_blank" rel={PUBLIC_LINK_REL} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: GOLD, fontWeight: 700 }}>
                Open the link to check it
              </a>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, flexShrink: 0 }}>
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
