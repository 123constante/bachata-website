// Edit in place: the ONE "Contact details" sheet (mockup "Contact sheet",
// screen 2). Phone (the repo's phone rule, fieldRules.checkPhone) with its
// switch, Email (read-only: the server refuses a non-admin change) with its
// switch, a "We will save" line, Done. Every line, switch state and the preview
// come from contactModel.contactItems(), the same mapping the Contact card and the
// save read. Done only changes the local draft; the page's ONE Save sends it.
//
// Keyboard: like FieldSheet, positioned against window.visualViewport
// (useKeyboardInset), so Done stays above the phone keyboard; 16px inputs; a
// modal dialog with focus in the phone box on open, Tab trapped, Escape and the
// overlay close it, and the caller returns focus to the "Edit contact details" row.
import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useKeyboardInset } from '@/modules/organiser/ui/useKeyboardInset';
import { CONTACT_COPY, contactDraftsFor, contactItems, contactWillSave, type ContactItem, type StoredContact } from './contactModel';
import type { Drafts } from './draftModel';
import { checkField } from './fieldRules';
import { inBody } from './layers';
import { CREAM, GOLD, INK } from './parts';
import { PHONE_FIELD_TOKENS, btn, inputStyle, sheetFrame, trapTab } from './sheetStyles';
import { PhoneInput } from '@/components/forms/PhoneInput';

export interface ContactSheetProps {
  stored: StoredContact;
  /** The current draft (the sheet opens with it laid over the stored values). */
  drafts: Drafts;
  /** The contact drafts that change something ({} when nothing does). */
  onDone: (contactDrafts: Drafts) => void;
  onClose: () => void;
}

const LINE = 'rgba(246,241,234,0.75)';

function SwitchRow({ item, onToggle }: { item: ContactItem; onToggle: () => void }) {
  const lineId = useId();
  const disabled = !!item.disabledReason;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, marginTop: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: CREAM }}>
          {item.label}
        </span>
        <p id={lineId} style={{ margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.35, color: disabled ? GOLD : LINE }} data-eip-switch-line={item.kind}>
          {item.line}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={item.isPublic}
        aria-label={`${item.label} on your page`}
        aria-describedby={lineId}
        disabled={disabled}
        onClick={onToggle}
        className="eip-btn"
        data-eip-switch={item.kind}
        style={{ minWidth: 44, minHeight: 44, padding: 0, background: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
      >
        <span aria-hidden="true" style={{ position: 'relative', width: 44, height: 26, borderRadius: 13, background: item.isPublic ? GOLD : 'rgba(246,241,234,0.22)', border: `1px solid ${item.isPublic ? GOLD : 'rgba(246,241,234,0.45)'}`, opacity: disabled ? 0.5 : 1, transition: 'background 150ms', boxSizing: 'border-box' }}>
          <span style={{ position: 'absolute', top: 2, left: item.isPublic ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: item.isPublic ? INK : CREAM, transition: 'left 150ms' }} />
        </span>
      </button>
    </div>
  );
}

export default function ContactSheet({ stored, drafts, onDone, onClose }: ContactSheetProps) {
  const titleId = useId();
  const subId = useId();
  const phoneId = useId();
  const emailId = useId();
  const emailNoteId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const { inset, height } = useKeyboardInset(true);
  const initialPhone = drafts.contact_phone ?? stored.phone ?? '';
  const [phone, setPhone] = useState(initialPhone);
  const [showPhone, setShowPhone] = useState(drafts.show_phone_publicly !== undefined ? drafts.show_phone_publicly === 'true' : stored.showPhone);
  const [showEmail, setShowEmail] = useState(drafts.show_email_publicly !== undefined ? drafts.show_email_publicly === 'true' : stored.showEmail);
  const [touched, setTouched] = useState(false);

  const items = useMemo(
    () => contactItems(stored, { contact_phone: phone, show_phone_publicly: String(showPhone), show_email_publicly: String(showEmail) }),
    [stored, phone, showPhone, showEmail],
  );
  const check = useMemo(() => checkField('contact_phone', phone), [phone]);
  // A stored number saved before the one phone rule (no '+') is kept as it is until it is changed: never a blocked Done.
  const phoneOk = check.ok || phone === (stored.phone ?? '');
  // An edited number is the field's to explain, at once, since Done is off ("Looks short. ..."); the sheet speaks only for an untouched stored draft it refuses (one message, never two).
  const showError = touched && phone === initialPhone && !phoneOk ? check.error : null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    trapTab(e, sheetRef.current);
  };

  const done = () => {
    setTouched(true);
    if (!phoneOk) return;
    onDone(contactDraftsFor(stored, { phone, showPhone, showEmail }));
  };

  const label = { display: 'block', margin: '10px 0 4px', fontSize: 13, fontWeight: 700, color: CREAM } as const;

  // In document.body (see layers.tsx), so no page ancestor can re-anchor it.
  return inBody(
    <>
      <div aria-hidden="true" data-testid="eip-sheet-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)' }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subId} onKeyDown={onKeyDown} style={sheetFrame(inset, height)} data-testid="eip-contact-sheet">
        <h2 id={titleId} style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{CONTACT_COPY.title}</h2>
        <p id={subId} style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(246,241,234,0.75)' }}>{CONTACT_COPY.sub}</p>

        <label htmlFor={phoneId} style={label}>Phone</label>
        {/* The ONE phone field (country first, saved as E.164). The sheet sits in document.body, so it carries the theme itself. */}
        <div className="org-theme" style={{ ...PHONE_FIELD_TOKENS, background: 'transparent' } as CSSProperties} data-testid="eip-contact-phone">
          <PhoneInput inputId={phoneId} value={phone} stored={stored.phone ?? ''} onChange={(e164) => setPhone(e164)} autoFocus error={showError} feedbackTestId="eip-phone-feedback" showShort={phone !== initialPhone && !phoneOk} />
        </div>
        <SwitchRow item={items.phone} onToggle={() => setShowPhone(!items.phone.isPublic)} />

        <label htmlFor={emailId} style={label}>Email</label>
        <input
          id={emailId}
          type="email"
          value={stored.email ?? ''}
          readOnly
          placeholder={CONTACT_COPY.notAdded}
          aria-describedby={emailNoteId}
          style={{ ...inputStyle, color: 'rgba(246,241,234,0.85)', background: 'rgba(246,241,234,0.03)' }}
        />
        <p id={emailNoteId} style={{ margin: '4px 0 0', fontSize: 12.5, color: LINE }}>{CONTACT_COPY.emailAdminOnly}</p>
        <SwitchRow item={items.email} onToggle={() => setShowEmail(!items.email.isPublic)} />

        <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.4, overflowWrap: 'anywhere' }} data-testid="eip-will-save">
          <span style={{ color: 'rgba(246,241,234,0.7)' }}>We will save:</span> <span>{contactWillSave(items)}</span>
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose} style={{ ...btn, background: 'none', border: '1px solid rgba(246,241,234,0.25)', color: CREAM }}>
            Cancel
          </button>
          <button type="button" onClick={done} disabled={!phoneOk} aria-disabled={!phoneOk} style={{ ...btn, background: GOLD, color: INK, border: 'none', opacity: phoneOk ? 1 : 0.5 }}>
            Done
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: LINE, textAlign: 'right' }}>{CONTACT_COPY.hint}</p>
      </div>
    </>,
  );
}
