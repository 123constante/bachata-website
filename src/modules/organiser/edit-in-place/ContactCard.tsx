// Edit in place: the owner's Contact card on the live page. Each item shows its
// masked value and a Public / Hidden tag read from contactModel.contactItems()
// (the same fact the sheet's switch and the save use), and ONE "Edit contact
// details" row opens the Contact details sheet. Owner / manager only: it is in
// the lazy layer, so a visitor downloads none of it.
import type { CSSProperties, MouseEvent } from 'react';
import { Pencil } from 'lucide-react';
import { CONTACT_COPY, type ContactItem } from './contactModel';
import { CREAM, GOLD, INK, UnsavedTag } from './parts';

export type ContactLoad = 'loading' | 'failed' | 'ready';

const MUTED = 'rgba(246,241,234,0.7)';

const tagStyle = (pub: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
  whiteSpace: 'nowrap', flexShrink: 0,
  ...(pub ? { background: 'rgba(231,190,110,0.16)', color: GOLD, border: `1px solid ${GOLD}` } : { background: 'transparent', color: MUTED, border: '1px solid rgba(246,241,234,0.35)' }),
});

function ItemRow({ item }: { item: ContactItem }) {
  return (
    <li data-testid={`eip-contact-${item.kind}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
      <span style={{ width: 56, flexShrink: 0, fontSize: 12, fontWeight: 600, color: MUTED }}>{item.label}</span>
      <span
        className={item.drafted ? 'eip-drafted' : undefined}
        style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, color: item.empty ? MUTED : CREAM }}
      >
        {item.masked ?? CONTACT_COPY.notAdded}
      </span>
      {item.drafted && <UnsavedTag field={item.kind === 'phone' ? 'contact_phone' : 'show_email_publicly'} />}
      {item.tag && <span style={tagStyle(item.tag === 'Public')} data-eip-contact-tag={item.tag}>{item.tag}</span>}
    </li>
  );
}

export function ContactCard({ load, items, onEdit, onRetry }: {
  load: ContactLoad;
  items: { phone: ContactItem; email: ContactItem } | null;
  onEdit: (opener: HTMLElement) => void;
  onRetry: () => void;
}) {
  const reasonId = 'eip-contact-reason';
  const ready = load === 'ready' && !!items;
  return (
    <section aria-labelledby="eip-contact-title" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="eip-contact">
      <h2 id="eip-contact-title" style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: GOLD }}>{CONTACT_COPY.card}</h2>
      <div style={{ maxWidth: 480 }}>
        {ready && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <ItemRow item={items.phone} />
            <ItemRow item={items.email} />
          </ul>
        )}
        {load === 'loading' && <p id={reasonId} role="status" style={{ margin: '4px 0', fontSize: 13, color: MUTED }}>{CONTACT_COPY.loading}</p>}
        {load === 'failed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '4px 0' }}>
            <p id={reasonId} role="alert" style={{ margin: 0, flex: '1 1 200px', fontSize: 13, color: '#FFB4A2' }}>{CONTACT_COPY.failed}</p>
            <button type="button" className="eip-btn" onClick={onRetry} style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, background: 'none', border: '1px solid rgba(246,241,234,0.3)', color: CREAM, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {CONTACT_COPY.retry}
            </button>
          </div>
        )}
        <button
          type="button"
          className="eip-btn"
          data-eip-pencil="contact"
          disabled={!ready}
          aria-describedby={ready ? undefined : reasonId}
          onClick={(e: MouseEvent<HTMLButtonElement>) => onEdit(e.currentTarget)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 44, padding: 0, marginTop: 2, background: 'none', border: 'none', borderTop: '1px solid rgba(246,241,234,0.08)', color: ready ? GOLD : MUTED, fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'default', textAlign: 'left' }}
        >
          {CONTACT_COPY.editRow}
          <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: ready ? GOLD : 'rgba(246,241,234,0.25)', color: INK, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pencil width={14} height={14} strokeWidth={2.4} />
          </span>
        </button>
      </div>
    </section>
  );
}
