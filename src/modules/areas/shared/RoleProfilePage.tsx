import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnnounceRegion, Card, ErrorState, Field, PrimaryButton, SkeletonRows, useAnnounce, useShake } from '@/modules/organiser/ui';
import { fetchMyRoleDetails, roleDetailsQueryKey, saveMyRole, type RoleDetails } from './areaApi';
import { AreaFrame } from './AreaFrame';
import { ROLE_ERROR_COPY, roleErrorCode, roleErrorMessage, type RoleErrorCode } from './errorCopy';
import { ROLE_FIELDS, ROLE_NAME, ROLE_NOUN, type Role } from './fieldRegistry';
import { FieldInput } from './inputs';
import { diffPatch, toDraft, validatePatch, type Details, type Draft } from './roleModel';

export const NOTHING_CHANGED = 'Nothing has changed yet, so there is nothing to save.';
export const SAVED = 'Saved';

export interface RoleProfileFormProps {
  role: Role;
  details: Details;
  saving: boolean;
  /** Called with ONLY the changed keys; never with an empty patch. */
  onSave(patch: Record<string, unknown>): void;
  serverError: string | null;
}

/** Every role field, grouped, each marked optional. Untouched = Save disabled, with the reason on screen. */
export function RoleProfileForm({ role, details, saving, onSave, serverError }: RoleProfileFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(role, details));
  const [errors, setErrors] = useState<Record<string, RoleErrorCode>>({});
  const { shake, shakeProps } = useShake();
  const patch = useMemo(() => diffPatch(role, details, draft), [role, details, draft]);
  const dirty = Object.keys(patch).length > 0;
  const groups = useMemo(() => {
    const out: { name: string; fields: (typeof ROLE_FIELDS)[Role][number][] }[] = [];
    for (const f of ROLE_FIELDS[role]) {
      const g = out.find((x) => x.name === f.group);
      if (g) g.fields.push(f);
      else out.push({ name: f.group, fields: [f] });
    }
    return out;
  }, [role]);

  const submit = () => {
    if (!dirty) return;
    const found = validatePatch(role, patch);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      shake();
      return;
    }
    onSave(patch);
  };

  return (
    <form
      noValidate
      className="space-y-[16px]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="px-[4px] text-[14px] text-[var(--mut)]">Every detail is optional. Fill in what you like and leave the rest.</p>
      {groups.map((g) => (
        <Card key={g.name} label={g.name} variant="padded">
          <div className="space-y-[16px]">
            {g.fields.map((f) => {
              const id = `${role}-${f.key}`;
              return (
                <Field
                  key={f.key}
                  label={`${f.label} (optional)`}
                  htmlFor={f.kind === 'yesno' ? undefined : id}
                  help={f.help}
                  error={errors[f.key] ? ROLE_ERROR_COPY[errors[f.key]] : null}
                  testId={`field-${f.key}`}
                >
                  <FieldInput
                    field={f}
                    id={id}
                    value={draft[f.key]}
                    disabled={saving}
                    describedBy={f.help ? `${id}-help` : undefined}
                    onChange={(v) => {
                      setDraft((d) => ({ ...d, [f.key]: v }));
                      if (errors[f.key]) setErrors(({ [f.key]: _gone, ...rest }) => rest);
                    }}
                  />
                </Field>
              );
            })}
          </div>
        </Card>
      ))}
      <div className="space-y-[8px]">
        {serverError && <p role="alert" data-testid="save-error" className="text-[14px] text-[var(--danger)]">{serverError}</p>}
        <PrimaryButton type="submit" testId="save-details" disabled={!dirty} loading={saving} {...shakeProps}>
          Save {ROLE_NOUN[role]} details
        </PrimaryButton>
        {!dirty && !saving && <p data-testid="save-reason" className="text-center text-[13px] text-[var(--mut)]">{NOTHING_CHANGED}</p>}
      </div>
    </form>
  );
}

/** The teacher / DJ details edit page. */
export function RoleProfilePage({ role, areaPath }: { role: Role; areaPath: string }) {
  const qc = useQueryClient();
  const [announcement, announce] = useAnnounce();
  const details = useQuery({ queryKey: roleDetailsQueryKey(role), queryFn: () => fetchMyRoleDetails(role) });
  // Bumped after each save so the form restarts from what the server now holds.
  const [formKey, setFormKey] = useState(0);
  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveMyRole(role, patch),
    onSuccess: (res) => {
      qc.setQueryData<RoleDetails>(roleDetailsQueryKey(role), { role: res.role, personId: res.personId, details: res.details });
      setFormKey((k) => k + 1);
      announce(SAVED);
    },
  });
  const name = ROLE_NAME[role];
  return (
    <AreaFrame title={`${name} details`} back={{ to: areaPath, label: name }} testId={`${role}-profile`}>
      <AnnounceRegion message={announcement} />
      {details.status === 'pending' ? (
        <SkeletonRows count={4} label={`Loading your ${ROLE_NOUN[role]} details`} />
      ) : details.status === 'error' ? (
        <ErrorState
          testId="details-error"
          body={roleErrorCode(details.error) ? roleErrorMessage(details.error) : undefined}
          onRetry={() => void details.refetch()}
          retrying={details.isFetching}
        />
      ) : (
        <RoleProfileForm
          key={formKey}
          role={role}
          details={details.data.details}
          saving={save.isPending}
          serverError={save.isError ? roleErrorMessage(save.error) : null}
          onSave={(patch) => save.mutate(patch)}
        />
      )}
    </AreaFrame>
  );
}
