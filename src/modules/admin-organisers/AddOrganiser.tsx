import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CityPicker } from '@/components/ui/city-picker';
import { addOrganiser, FRONT_DOOR_LIST_KEY, type AddResult } from './frontDoorApi';
import {
  ADD_ERROR_FALLBACK, EMPTY_FORM, RUN_BY_US_LABEL, runByUsHint, SEND_HINT,
  errorFor, outcomeFor, submitBlockedReason, type AddForm,
} from './addOrganiserModel';
import { BTN, BTN_PRIMARY, FIELD, organiserHref } from './frontDoorUi';

export function AddOrganiser({ onOpenList }: { onOpenList: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [result, setResult] = useState<AddResult | null>(null);
  const inFlight = useRef(false);
  const set = <K extends keyof AddForm>(k: K, v: AddForm[K]) => { setForm((f) => ({ ...f, [k]: v })); setResult(null); };

  const add = useMutation({
    mutationFn: () => addOrganiser(form),
    onSuccess: (r) => {
      setResult(r);
      if (r.kind !== 'error') void queryClient.invalidateQueries({ queryKey: FRONT_DOOR_LIST_KEY });
    },
    onError: () => setResult({ kind: 'error', code: 'NETWORK', field: null }),
    onSettled: () => { inFlight.current = false; },
  });

  const blocked = submitBlockedReason(form);
  const err = result?.kind === 'error' ? errorFor(result.code, result.field) : null;
  const fieldErr = (f: string) => err && err.field === f
    ? <p role="alert" id={`add-err-${f}`} className="text-sm text-destructive" data-testid={`add-error-${f}`}>{err.text}</p>
    : null;
  const outcome = result && result.kind !== 'error' ? outcomeFor(result) : null;

  const submit = () => {
    if (blocked || inFlight.current) return; // an untouched form and a double tap send nothing
    inFlight.current = true;
    add.mutate();
  };

  return (
    <form data-testid="add-organiser" className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label className="block space-y-1 text-sm font-medium">
        Organiser name
        <input className={FIELD} value={form.organiserName} onChange={(e) => set('organiserName', e.target.value)} autoComplete="off" aria-describedby="add-err-organiser_name" data-testid="add-organiser-name" />
      </label>
      {fieldErr('organiser_name')}
      <label className="block space-y-1 text-sm font-medium">
        Contact person
        <input className={FIELD} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} autoComplete="off" aria-describedby="add-err-contact_name" data-testid="add-contact-name" />
      </label>
      {fieldErr('contact_name')}
      <div className="space-y-1 text-sm font-medium">
        <label htmlFor="add-city">City</label>
        <CityPicker id="add-city" value={form.cityId || undefined} onChange={(id) => set('cityId', id)} placeholder="Pick a city" className="min-h-[44px] w-full" />
      </div>
      {fieldErr('city_id')}
      <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium">
        <input
          type="checkbox" role="switch" className="h-6 w-6" checked={form.runByUs}
          onChange={(e) => setForm((f) => ({ ...f, runByUs: e.target.checked, contactEmail: e.target.checked ? '' : f.contactEmail }))}
          aria-describedby="add-rbu-why" data-testid="add-run-by-us"
        />
        {RUN_BY_US_LABEL}
      </label>
      <p id="add-rbu-why" className="text-xs text-muted-foreground" data-testid="add-rbu-why">{runByUsHint(form.runByUs)}</p>
      <label className="block space-y-1 text-sm font-medium">
        Contact email (optional)
        <input
          type="email" inputMode="email" autoComplete="off" className={FIELD} value={form.contactEmail} disabled={form.runByUs}
          onChange={(e) => set('contactEmail', e.target.value)} aria-describedby={form.runByUs ? 'add-rbu-why' : 'add-err-contact_email'} data-testid="add-contact-email"
        />
      </label>
      {fieldErr('contact_email')}
      <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={!!blocked || add.isPending} aria-describedby={blocked ? 'add-blocked' : undefined} data-testid="add-submit">
        {add.isPending ? 'Adding…' : 'Add organiser'}
      </button>
      {blocked && <p id="add-blocked" className="text-xs text-muted-foreground" data-testid="add-blocked">{blocked}</p>}
      {err && !err.field && <p role="alert" className="text-sm text-destructive" data-testid="add-error-form">{err.text || ADD_ERROR_FALLBACK}</p>}
      {outcome && (
        <div role="status" data-testid="add-outcome" data-kind={result?.kind} className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold">{outcome.title}</p>
          {outcome.lines.map((l) => <p key={l} className="text-sm">{l}</p>)}
          <div className="flex flex-wrap gap-2">
            {outcome.organiserId && <a className={BTN} href={organiserHref(outcome.organiserId)} data-testid="add-open-organiser">Open the organiser</a>}
            <button type="button" className={BTN} onClick={onOpenList} data-testid="add-open-list">Go to the organisers list</button>
          </div>
          {result?.kind === 'created' && result.inviteQueued && <p className="text-xs text-muted-foreground">{SEND_HINT}</p>}
        </div>
      )}
    </form>
  );
}
