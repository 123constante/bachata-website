import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { isAreaShown } from '../home/areaStatus';
import { fetchMyRoles, myRolesQueryKey } from '../home/rolesApi';
import { AnnounceRegion, Card, ErrorState, Field, PrimaryButton, SkeletonRows, useAnnounce, useShake } from '@/modules/organiser/ui';
import { fetchMyRoleDetails, roleDetailsQueryKey, saveMyRole, type RoleDetails } from './areaApi';
import { AreaFrame } from './AreaFrame';
import { BlockedState, blockedCode, type BlockedPaths } from './BlockedState';
import { ROLE_ERROR_COPY, roleErrorCode, roleErrorMessage, type RoleErrorCode } from './errorCopy';
import { ROLE_FIELDS, ROLE_NAME, ROLE_NOUN, type Role } from './fieldRegistry';
import { FieldInput } from './inputs';
import { useLeaveGuard } from './leaveGuard';
import { SavedToast } from './SavedToast';
import { diffPatch, toDraft, validatePatch, withPendingDraft, type Details, type Draft } from './roleModel';

export const NOTHING_CHANGED = 'Nothing changed yet';
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
  // Text typed in a list box but not yet added counts as added (D27).
  const [pending, setPending] = useState<Record<string, string>>({});
  const patch = useMemo(() => diffPatch(role, details, withPendingDraft(role, draft, pending)), [role, details, draft, pending]);
  const dirty = Object.keys(patch).length > 0;
  useLeaveGuard(dirty);
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
                    onPendingChange={(t) => setPending((p) => ({ ...p, [f.key]: t }))}
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
export function RoleProfilePage({ role, areaPath, blocked }: { role: Role; areaPath: string; blocked: BlockedPaths }) {
  const qc = useQueryClient();
  const [announcement, announce] = useAnnounce();
  const details = useQuery({ queryKey: roleDetailsQueryKey(role), queryFn: () => fetchMyRoleDetails(role) });
  // Bumped after each save so the form restarts from what the server now holds.
  const [formKey, setFormKey] = useState(0);
  const [toast, setToast] = useState(false);
  const hideToast = useCallback(() => setToast(false), []);
  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveMyRole(role, patch),
    onSuccess: (res) => {
      qc.setQueryData<RoleDetails>(roleDetailsQueryKey(role), { role: res.role, personId: res.personId, details: res.details });
      setFormKey((k) => k + 1);
      announce(SAVED);
      setToast(true);
    },
  });
  // A role that is not added has no details page: the person goes to the area page, which says why and offers Add (F1).
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  const progress = useProfileProgress(null);
  const name = ROLE_NAME[role];
  if (roles.status === 'success' && progress.status !== 'pending' && !isAreaShown(role, roles.data.find((r) => r.role === role), progress.data)) {
    return <Navigate to={areaPath} replace />;
  }
  return (
    <AreaFrame title={`${name} details`} back={{ to: areaPath, label: name }} testId={`${role}-profile`}>
      <AnnounceRegion message={announcement} />
      <SavedToast show={toast} onDone={hideToast} />
      {details.status === 'pending' || roles.status === 'pending' || progress.status === 'pending' ? (
        <SkeletonRows count={4} label={`Loading your ${ROLE_NOUN[role]} details`} />
      ) : details.status === 'error' && blockedCode(details.error) ? (
        <BlockedState code={blockedCode(details.error)!} paths={blocked} />
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
