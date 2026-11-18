import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CodeBoxes, emptyDigits } from '@/modules/tickets/CodeBoxes';
import {
  NEEDS_NEW_CODE, SENT_LINE, confirmAccountLink, fetchAccountLinks, linkErrorLine, linkedLine, requestAccountLink, unlinkAccount,
  type LinkedAccount,
} from '../../api/accountLink';

export const LINK_OPEN = 'Have tickets under another email?';
export const unlinkConfirmLine = (email: string) => `Unlink ${email}? Its tickets stop showing here.`;

/** Dark-sheet palette for the shared checkout code boxes (dancer tokens). */
const BOX_COLORS = { ink: 'var(--da-text)', line: 'var(--da-border)', bad: '#ff6b6b', bg: 'var(--da-surface-2)' };
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/**
 * My tickets: "Have tickets under another email?" -> a sheet (email -> 6-digit code), plus the
 * "Linked accounts" list with Unlink. Renders NOTHING until my_account_links_v1 answers ok:
 * flag off (error 'disabled') or any failure = hidden, quietly. `onLinked` refetches My tickets.
 */
export function AccountLinkPanel({ onLinked }: { onLinked(): void }) {
  const [links, setLinks] = useState<LinkedAccount[] | null>(null);
  const [off, setOff] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState(false);
  const [rowErr, setRowErr] = useState('');

  const reload = useCallback(async () => {
    const r = await fetchAccountLinks();
    if (r.ok) setLinks(r.value ?? []);
    else if (r.code === 'disabled') setOff(true);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  if (off || links === null) return null;

  async function unlink(userId: string) {
    setRowBusy(true); setRowErr('');
    const r = await unlinkAccount(userId);
    setRowBusy(false);
    if (!r.ok && r.code === 'disabled') { setOff(true); return; }
    if (!r.ok) { setRowErr(linkErrorLine(r.code)); return; }
    setConfirming(null);
    await reload();
    onLinked();
  }

  return (
    <div className="dt-link-panel" data-testid="account-link-panel">
      <button type="button" className="dt-quiet-link" onClick={() => setOpen(true)} data-testid="account-link-open">{LINK_OPEN}</button>
      {links.length > 0 && (
        <section aria-labelledby="dt-linked-title" data-testid="account-link-list">
          <h2 id="dt-linked-title" className="dt-linked-title">Linked accounts</h2>
          <ul className="dt-linked">
            {links.map((l) => (
              <li key={l.userId} className="dt-linked-row" data-testid="account-link-row">
                {confirming === l.userId ? (
                  <>
                    <span className="dt-linked-email">{unlinkConfirmLine(l.email)}</span>
                    <span className="dt-linked-actions">
                      <button type="button" className="dt-quiet-link" disabled={rowBusy} onClick={() => void unlink(l.userId)} data-testid="account-unlink-confirm">Unlink</button>
                      <button type="button" className="dt-quiet-link" disabled={rowBusy} onClick={() => { setConfirming(null); setRowErr(''); }}>Keep</button>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="dt-linked-email">{l.email}</span>
                    <button type="button" className="dt-quiet-link" onClick={() => { setConfirming(l.userId); setRowErr(''); }} data-testid="account-unlink">Unlink</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {rowErr && <p className="dt-link-bad" role="alert">{rowErr}</p>}
        </section>
      )}
      {open && (
        <LinkSheet
          onClose={() => setOpen(false)}
          onDisabled={() => { setOpen(false); setOff(true); }}
          onLinked={() => { void reload(); onLinked(); }}
        />
      )}
    </div>
  );
}

function LinkSheet({ onClose, onDisabled, onLinked }: { onClose(): void; onDisabled(): void; onLinked(): void }) {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [shake, setShake] = useState(false);
  const [needsNew, setNeedsNew] = useState(false);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const v = email.trim();
    if (!isEmail(v)) { setErr(linkErrorLine('invalid_email')); return; }
    setBusy(true); setErr('');
    const r = await requestAccountLink(v);
    setBusy(false);
    if (!r.ok && r.code === 'disabled') { onDisabled(); return; }
    if (!r.ok) { setErr(linkErrorLine(r.code)); return; }
    setDigits(emptyDigits()); setNeedsNew(false); setStep('code');
  }

  async function check(code: string) {
    if (busy) return;
    setBusy(true);
    const r = await confirmAccountLink(code);
    setBusy(false);
    if (r.ok) { setErr(''); setStep('done'); onLinked(); return; }
    if (r.code === 'disabled') { onDisabled(); return; }
    setErr(linkErrorLine(r.code));
    setNeedsNew(NEEDS_NEW_CODE.has(r.code));
    setShake(true); setTimeout(() => setShake(false), 300);
    setDigits(emptyDigits());
    if (!NEEDS_NEW_CODE.has(r.code)) boxes.current[0]?.focus();
  }

  const restart = () => { setErr(''); setNeedsNew(false); setStep('email'); };

  return (
    <div className="dt-sheet-scrim" onClick={onClose} data-testid="account-link-scrim">
      <div className="dt-sheet" role="dialog" aria-modal="true" aria-labelledby="dt-link-title" onClick={(e) => e.stopPropagation()} data-testid="account-link-sheet">
        <div className="dt-sheet-head">
          <h2 id="dt-link-title" className="dt-sheet-title">Link another email</h2>
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Close" data-testid="account-link-close">
            <X aria-hidden="true" style={{ width: 18, height: 18 }} />
          </button>
        </div>
        {step === 'email' && (
          <form onSubmit={(e) => void send(e)} noValidate>
            <p className="dt-sheet-sub">We&rsquo;ll send a 6-digit code to that email. Enter it here to show its tickets on this account.</p>
            <input type="email" inputMode="email" autoComplete="email" aria-label="Your other email" placeholder="you@example.com" value={email} autoFocus
              onChange={(e) => { setEmail(e.target.value); setErr(''); }} className="dt-link-input" data-testid="account-link-email" />
            {err && <p className="dt-link-bad" role="alert" data-testid="account-link-error">{err}</p>}
            <button type="submit" className="dt-btn dt-link-wide" disabled={busy} data-testid="account-link-send">{busy ? <>Sending&hellip;</> : 'Send code'}</button>
          </form>
        )}
        {step === 'code' && (
          <div>
            <p className="dt-sheet-sub" role="status" data-testid="account-link-sent">{SENT_LINE}</p>
            <CodeBoxes testId="link-code-boxes" digits={digits} onDigits={(n) => { setDigits(n); if (!needsNew) setErr(''); }} onComplete={(c) => void check(c)}
              busy={busy || needsNew} bad={Boolean(err)} shake={shake} boxes={boxes} colors={BOX_COLORS} />
            <p className="dt-link-bad dt-link-err-slot" role="alert" data-testid="account-link-error">{err}</p>
            <div className="dt-link-row2">
              <button type="button" className="dt-quiet-link" onClick={restart} data-testid="account-link-new">{needsNew ? 'Send a new code' : 'Change email'}</button>
            </div>
          </div>
        )}
        {step === 'done' && (
          <div>
            <p className="dt-sheet-sub" role="status" data-testid="account-link-done">{linkedLine(email.trim())}</p>
            <button type="button" className="dt-btn dt-link-wide" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
