import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Building2, FileText, Globe, Image as ImageIcon, LogOut, Mail, MapPin, ThumbsUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  organiserProfileSaveErrorToast,
  saveOrganiserProfile,
  type OrganiserProfileEditForm,
} from '@/lib/organiserProfileUpdate';
import { fetchOrganiserEntity, organiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { ORGANISER_HOME_KEY, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { OrganiserShell } from '../shell';
import {
  AnnounceRegion,
  Card,
  Cover,
  EmptyState,
  ErrorState,
  FIELD_CLASS,
  GhostButton,
  PreviewBar,
  PrimaryButton,
  SheetView,
  SkeletonRows,
  SummaryRow,
  TitleInput,
  initials,
  useAnnounce,
  useShake,
} from '../ui';
import { OrganiserSwitcher } from './OrganiserSwitcher';
import { useOrganiserChoice } from './useOrganiserChoice';
import { formFromEntity, instagramHandle, type ProfileEntity } from './profileForm';
import { ReviewCard } from './ReviewCard';
import { CityView } from './CityView';
import { sendBlockers } from './reviewModel';

/**
 * /account/o/profile (W4). The organiser's PUBLIC profile (name, about, logo,
 * city, Instagram and links) saved through organiser_profile_update_p5_v1, the
 * one write path for organiser_profiles (src/lib/organiserProfileUpdate.ts),
 * plus the account basics and Sign out. Instagram lives here, never on an event.
 * F1: the lifecycle and "Send for review" sit at the top (ReviewCard).
 */

type View = 'photo' | 'about' | 'city' | 'instagram' | 'website' | 'facebook' | 'signout';

interface City { id: string | null; name: string | null }

const TITLES: Record<View, string> = {
  photo: 'Logo or photo',
  about: 'About',
  city: 'City',
  instagram: 'Instagram',
  website: 'Website',
  facebook: 'Facebook',
  signout: 'Sign out',
};


function PublicCardPreview({ form, city }: { form: OrganiserProfileEditForm; city: string | null }) {
  const handle = instagramHandle(form.instagram);
  return (
    <div className="flex items-center gap-[12px] p-[12px]" data-testid="profile-preview">
      {form.avatar_url.trim() ? (
        <img src={form.avatar_url.trim()} alt="" loading="lazy" className="h-[44px] w-[44px] shrink-0 rounded-[12px] object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--card2)] text-[14px] font-bold text-[var(--fg)]">
          {initials(form.name || '?')}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--fg)]" data-testid="profile-preview-name">{form.name.trim() || 'Your organiser name'}</span>
        <span className="block truncate text-[13px] text-[var(--mut)]">
          {[city, handle ? `@${handle}` : null].filter(Boolean).join(' \u00b7 ') || 'Organiser'}
        </span>
      </span>
    </div>
  );
}

function AccountCard({ email, count, onSignOut }: { email: string | null; count: number | null; onSignOut: () => void }) {
  return (
    <Card label="Account" testId="profile-account">
      <SummaryRow icon={<Mail />} label="Signed in as" value={email ?? ''} testId="profile-email" />
      <SummaryRow icon={<Building2 />} label="Organisers you help run" value={count === null ? undefined : String(count)} testId="profile-org-count" />
      <SummaryRow icon={<LogOut />} label="Sign out" onPress={onSignOut} testId="profile-signout" />
    </Card>
  );
}

function ProfileEditor({ organiser, entity, sheetOpen, openSheet, top, bottom }: {
  organiser: HomeOrganiser; entity: ProfileEntity; sheetOpen: View | null; openSheet: (v: View | null) => void;
  top: ReactNode; bottom: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<OrganiserProfileEditForm>(() => formFromEntity(entity));
  const [form, setForm] = useState<OrganiserProfileEditForm>(saved);
  const [savedCity, setSavedCity] = useState<City>(() => ({ id: entity.city_id ?? null, name: entity.cities?.name ?? null }));
  const [city, setCity] = useState<City>(savedCity);
  const [error, setError] = useState<string | null>(null);
  const [message, announce] = useAnnounce();
  const { shake, shakeProps } = useShake();
  const set = (key: keyof OrganiserProfileEditForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved) || city.id !== savedCity.id;

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('name_required');
      if (!city.id) throw new Error('city_required');
      const { error: rpcError } = await saveOrganiserProfile(supabase, organiser.id, form, city.id);
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      setSaved(form);
      setSavedCity(city);
      setError(null);
      announce('Profile saved.');
      void queryClient.invalidateQueries({ queryKey: organiserEntityQueryKey(organiser.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    },
    onError: (err) => {
      const copy = organiserProfileSaveErrorToast(err);
      setError(copy.description ?? copy.title);
      shake();
    },
  });

  const editing = sheetOpen && sheetOpen !== 'signout' ? sheetOpen : null;
  const live = organiser.lifecycle_status === 'live';

  const bar = (
    <div>
      {error && <p role="alert" className="px-[16px] pt-[12px] text-[14px] text-[var(--danger)]" data-testid="profile-save-error">{error}</p>}
      <PreviewBar
        preview={<PublicCardPreview form={form} city={city.name} />}
        actionLabel={dirty ? 'Save profile' : 'Saved'}
        onAction={() => { setError(null); save.mutate(); }}
        loading={save.isPending}
        disabled={!dirty}
        live={live}
        compact={!dirty && !save.isPending}
        summary="All changes saved"
        shakeProps={shakeProps}
        testId="profile-bar"
      />
    </div>
  );

  return (
    <OrganiserShell title="Profile" testId="org-page-profile" actionBar={bar}>
      <AnnounceRegion message={message} />
      <div className="space-y-[20px]">
      {top}
      <ReviewCard
        organiser={organiser}
        blockers={sendBlockers({ name: saved.name, cityId: savedCity.id, dirty })}
        onSent={() => announce('Sent for review.')}
      />
      <div className="space-y-[20px] pb-[8px]">
        <Cover src={form.avatar_url.trim() || null} alt="" onChange={() => openSheet('photo')} changeLabel="Change logo or photo" emptyLabel="No logo yet" testId="profile-cover" className="w-[56%]" />
        <TitleInput value={form.name} onChange={set('name')} aria-label="Organiser name" placeholder="Organiser name" maxLength={80} testId="profile-name" />
        <Card label="About" testId="profile-about-card">
          <SummaryRow icon={<FileText />} label="About" sublabel={form.bio.trim() || 'Say who you are and what you run'} affordance="pencil" onPress={() => openSheet('about')} testId="profile-about" />
          <SummaryRow icon={<ImageIcon />} label="Logo or photo" value={form.avatar_url.trim() ? 'Set' : 'None'} onPress={() => openSheet('photo')} testId="profile-photo" />
          <SummaryRow icon={<MapPin />} label="City" value={city.name || (city.id ? 'Set' : 'Add')} onPress={() => openSheet('city')} testId="profile-city" />
        </Card>
        <Card label="Links" testId="profile-links">
          <SummaryRow icon={<AtSign />} label="Instagram" value={instagramHandle(form.instagram) ? `@${instagramHandle(form.instagram)}` : 'Add'} onPress={() => openSheet('instagram')} testId="profile-instagram" />
          <SummaryRow icon={<Globe />} label="Website" value={form.website.trim() || 'Add'} onPress={() => openSheet('website')} testId="profile-website" />
          <SummaryRow icon={<ThumbsUp />} label="Facebook" value={form.facebook.trim() || 'Add'} onPress={() => openSheet('facebook')} testId="profile-facebook" />
        </Card>
        <p className="text-[13px] text-[var(--mut)]">
          {live ? 'This is your public organiser page.' : 'Your organiser is not public yet. You can still get it ready here.'} Owners and managers can edit it.
        </p>
      </div>

      {bottom}
      </div>
      <FieldSheet
        view={editing} onClose={() => openSheet(null)} form={form} set={set}
        city={<CityView selectedId={city.id} onPick={(c) => { setCity({ id: c.id, name: c.label }); openSheet(null); }} />}
      />
    </OrganiserShell>
  );
}

function FieldSheet({ view, onClose, form, set, city }: {
  view: Exclude<View, 'signout'> | null; onClose: () => void;
  form: OrganiserProfileEditForm; set: (key: keyof OrganiserProfileEditForm) => (value: string) => void;
  /** The city search view (CityView), shown when `view` is 'city'. */
  city: ReactNode;
}) {
  const v = view ?? 'about';
  const fieldView = v === 'city' ? 'about' : v;
  const key: keyof OrganiserProfileEditForm = fieldView === 'photo' ? 'avatar_url' : fieldView === 'about' ? 'bio' : fieldView;
  const hint: Record<typeof fieldView, string> = {
    photo: 'Paste a link to your logo or a square photo (https://...).',
    about: 'A few lines guests read on your organiser page.',
    instagram: 'Your handle, like @ritmoleeds, or the link to your Instagram page.',
    website: 'Your own site or ticket page, like ritmo.example.',
    facebook: 'Your Facebook page name or link.',
  };
  return (
    <SheetView
      open={view !== null}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={TITLES[v]}
      viewKey={v}
      fullHeight={v === 'city'}
      footer={<PrimaryButton onClick={onClose} testId="profile-sheet-done">Done</PrimaryButton>}
      testId="profile-sheet"
    >
      {v === 'city' ? city : (
      <div className="space-y-[8px] p-[16px]">
        <label htmlFor={`profile-field-${fieldView}`} className="block text-[14px] text-[var(--mut)]">{hint[fieldView]}</label>
        {fieldView === 'about' ? (
          <textarea id={`profile-field-${fieldView}`} data-sheet-autofocus rows={6} maxLength={4000} value={form.bio} onChange={(e) => set('bio')(e.target.value)} className={`${FIELD_CLASS} py-[12px]`} data-testid="profile-field" />
        ) : (
          <input
            id={`profile-field-${fieldView}`} data-sheet-autofocus value={form[key]} onChange={(e) => set(key)(e.target.value)}
            inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            className={`${FIELD_CLASS} h-[48px]`} data-testid="profile-field"
          />
        )}
      </div>
      )}
    </SheetView>
  );
}

function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { shake, shakeProps } = useShake();
  const go = async () => {
    setBusy(true);
    setNote(null);
    const outcome = await signOut();
    setBusy(false);
    if (outcome === 'failed') {
      setNote('Sign-out did not complete. Check your connection and try again.');
      shake();
      return;
    }
    navigate('/', { replace: true });
  };
  return (
    <SheetView open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="Sign out" testId="signout-sheet">
      <div className={`space-y-[12px] p-[16px] ${shakeProps.className}`} onAnimationEnd={shakeProps.onAnimationEnd}>
        <p className="text-[15px] text-[var(--fg)]">Sign out of Bachata Calendar on this device? Changes you have not saved will be lost.</p>
        {note && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="signout-error">{note}</p>}
        <GhostButton onClick={onClose} disabled={busy} testId="signout-no">No, stay signed in</GhostButton>
        <PrimaryButton onClick={() => void go()} loading={busy} loadingLabel="Signing out" testId="signout-yes">Yes, sign out</PrimaryButton>
      </div>
    </SheetView>
  );
}

export default function ProfilePage() {
  const { user, home, organisers, selected, choose } = useOrganiserChoice();
  const [sheet, setSheet] = useState<View | null>(null);

  const entity = useQuery({
    queryKey: organiserEntityQueryKey(selected?.id),
    queryFn: () => fetchOrganiserEntity(selected!.id),
    enabled: !!selected,
  });

  let body: ReactNode = null;
  if (home.isPending) body = <SkeletonRows count={3} label="Loading your profile" testId="profile-loading" />;
  else if (home.isError && !home.data) body = <ErrorState title="Your profile did not load" onRetry={() => void home.refetch()} retrying={home.isFetching} testId="profile-load-error" />;
  else if (!selected) body = <EmptyState title="You don&rsquo;t run an organiser yet" body="Claim yours or create one from Home, then you can edit its public profile here." testId="profile-no-organiser" />;
  else if (entity.isPending) body = <SkeletonRows count={3} label="Loading your profile" testId="profile-loading" />;
  else if (entity.isError) body = <ErrorState title="Your profile did not load" onRetry={() => void entity.refetch()} retrying={entity.isFetching} testId="profile-load-error" />;
  else if (!entity.data) body = <EmptyState title="This profile is not available" body="It may have been switched off. Ask the Bachata Calendar team." testId="profile-missing" />;

  const top = <OrganiserSwitcher organisers={organisers} selectedId={selected?.id ?? null} onChoose={choose} />;
  const bottom = (
    <>
      <AccountCard email={user?.email ?? null} count={home.data ? organisers.length : null} onSignOut={() => setSheet('signout')} />
      <SignOutSheet open={sheet === 'signout'} onClose={() => setSheet(null)} />
    </>
  );
  if (selected && entity.data) {
    return <ProfileEditor key={selected.id} organiser={selected} entity={entity.data as ProfileEntity} sheetOpen={sheet} openSheet={setSheet} top={top} bottom={bottom} />;
  }
  return (
    <OrganiserShell title="Profile" testId="org-page-profile">
      <div className="space-y-[20px]">
        {top}
        {body}
        {bottom}
      </div>
    </OrganiserShell>
  );
}
