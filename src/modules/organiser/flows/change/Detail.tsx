import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { overrideCommand } from '@/modules/organiser/shared/seriesCommands';
import { FLYER_PROBLEM_COPY, FlyerError, reencodeFlyer } from '@/modules/organiser/shared/flyerModel';
import { flyerUploadProblem, uploadFlyer } from '@/modules/organiser/shared/flyerUploadApi';
import { FIELD_CLASS, GhostButton } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';
import { DateStep, type DateStepReady } from './DateStep';
import { DETAIL_DONE, DETAIL_KEY, DETAIL_LABEL, isDetailField, ticketProblem, type DetailField } from './changeModel';
import { useChangeSend } from './useChange';
import { Missing, SaveButton } from './parts';
import { EventConflict } from '../event/parts';

/**
 * C26: this date's own note, ticket link or picture
 * (occurrence.set_override {description | ticket_url | cover_image_url}).
 * Save only once the value differs; "Use the usual" clears the date's own
 * value (null) and is offered only when the date has one.
 */
export default function Detail() {
  const { field } = useParams();
  if (!isDetailField(field)) return <Missing />;
  return (
    <DateStep back={ORG_PATHS.changeDate} title={() => DETAIL_LABEL[field]}>
      {(ready) => <DetailForm key={`${ready.occurrenceId}-${field}`} field={field} {...ready} />}
    </DateStep>
  );
}

function own(field: DetailField, d: DateStepReady['detail']): string | null {
  return field === 'note' ? d.descriptionOverride : field === 'ticket' ? d.ticketUrlOverride : d.coverImageOverride;
}
function usual(field: DetailField, ws: DateStepReady['ws']): string | null {
  return field === 'note' ? ws.series.default_description : field === 'ticket' ? ws.series.default_ticket_url : ws.series.default_cover_image_url;
}

function DetailForm({ field, seriesId, occurrenceId, detail, ws }: DateStepReady & { field: DetailField }) {
  const current = own(field, detail) ?? '';
  const [value, setValue] = useState(current);
  const [uploading, setUploading] = useState(false);
  const [picError, setPicError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { send, busy, conflict, error } = useChangeSend(seriesId, occurrenceId);
  if (conflict) return <EventConflict seriesId={seriesId} testId="change-conflict" />;
  const key = DETAIL_KEY[field];
  const problem = field === 'ticket' ? ticketProblem(value) : null;
  const changed = value.trim() !== current.trim() && value.trim() !== '';
  const ready = changed && !problem;
  const fallback = usual(field, ws);
  const save = () => void send(overrideCommand({ [key]: value }), detail.version, DETAIL_DONE[field]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setPicError(null);
    try {
      setValue(await uploadFlyer(seriesId, await reencodeFlyer(file)));
    } catch (err) {
      setPicError(FLYER_PROBLEM_COPY[err instanceof FlyerError ? err.problem : flyerUploadProblem(err)]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="change-detail-screen">
      {field === 'picture' ? (
        <>
          {value ? (
            <img src={value} alt="This date&rsquo;s picture" loading="lazy" width={390} height={220}
              className="h-[220px] w-full rounded-[12px] object-cover" data-testid="change-detail-picture" />
          ) : (
            <p className="text-[14px] text-[var(--mut)]">{fallback ? <>This date uses the event&rsquo;s picture.</> : 'No picture yet.'}</p>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="change-detail-file"
            onChange={(e) => void pick(e.target.files?.[0])} />
          <GhostButton testId="change-detail-choose" loading={uploading} loadingLabel="Uploading" onClick={() => fileRef.current?.click()}>
            Choose a picture
          </GhostButton>
          {picError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="change-detail-picture-error">{picError}</p>}
        </>
      ) : field === 'note' ? (
        <textarea
          aria-label={DETAIL_LABEL.note}
          value={value}
          rows={4}
          maxLength={2000}
          placeholder={fallback ?? 'What dancers should know about this date'}
          onChange={(e) => setValue(e.target.value)}
          data-testid="change-detail-input"
          className={cn(FIELD_CLASS, 'min-h-[104px] py-2 text-[16px]')}
        />
      ) : (
        <input
          type="url"
          inputMode="url"
          aria-label={DETAIL_LABEL.ticket}
          value={value}
          placeholder={fallback ?? 'https://'}
          onChange={(e) => setValue(e.target.value)}
          data-testid="change-detail-input"
          className={cn(FIELD_CLASS, 'h-[52px] text-[16px]')}
        />
      )}
      <SaveButton
        ready={ready}
        reason={problem ?? (field === 'picture' ? 'Choose a picture' : 'Type something new')}
        busy={busy || uploading}
        error={error}
        onSave={save}
      />
      {current && (
        <GhostButton testId="change-detail-usual" disabled={busy}
          onClick={() => void send(overrideCommand({ [key]: null }), detail.version, DETAIL_DONE[field])}>
          Use the event&rsquo;s usual {field === 'note' ? 'note' : field === 'ticket' ? 'ticket link' : 'picture'}
        </GhostButton>
      )}
    </div>
  );
}
