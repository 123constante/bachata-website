# Organiser UI primitives (W0)

Import from `@/modules/organiser/ui`. All of them assume they render inside
`.org-theme` (OrganiserShell or SheetView adds it). Every primitive takes `testId`.
Full API table and contrast table: `docs/organiser-rebuild/ARC.md`.

## Screen skeleton

```tsx
<OrganiserShell title="Edit event" back={{ to: ORG_PATHS.events, label: 'Events' }}
  actionBar={<PreviewBar preview={<PublicCardPreview />} actionLabel="Save changes" onAction={save} loading={saving} shakeProps={shakeProps} />}>
  <Cover src={cover} alt="" onChange={() => setSheet('cover')} />
  <TitleInput value={name} onChange={setName} aria-label="Event name" placeholder="Event name" />
  <Card label="Date">
    <SummaryRow icon={<CalendarDays />} label="Starts on" value="Fri 9 Oct" onPress={() => setSheet('starts')} />
    <SummaryRow icon={<Repeat />} label="Repeats" value="Every Friday" onPress={() => setSheet('repeats')} />
  </Card>
</OrganiserShell>
```

One `PrimaryButton` per screen (here it is inside `PreviewBar`). Everything else is a
`GhostButton`, a `SummaryRow` or a gold link.

## One sheet, several views (no nested dialogs, no popovers)

```tsx
const [view, setView] = useState<'list' | 'search'>('list');
<SheetView open={open} onOpenChange={setOpen} fullHeight viewKey={view}
  title={view === 'list' ? 'Line-up' : 'Add a teacher'}
  onBack={view === 'search' ? () => setView('list') : undefined}
  footer={<PrimaryButton onClick={done}>Done</PrimaryButton>}>
  {view === 'list'
    ? <Card>{people.map((p) => <Collapse key={p.id} show={!p.removed}><PersonRow name={p.name} role="Teacher" onRemove={() => remove(p)} /></Collapse>)}</Card>
    : <SearchField value={q} onChange={setQ} aria-label="Search teachers" autoFocusInSheet />}
</SheetView>
```

- Changing `viewKey` swaps the body, scrolls it to the top and focuses `[data-sheet-autofocus]` (or the title).
- Escape in a sub-view (with `onBack`) goes back; otherwise it closes. Focus returns to the opener
  (pass `returnFocusRef` too: iOS Safari does not focus a tapped button).
- A `SheetView` inside a `SheetView` throws in development.
- Footer stays above the keyboard; on a visible height under 360px with the keyboard up it steps aside.

## Removal

Wrap each row in `<Collapse show={...}>`. Separate rows with Card dividers or spacing
INSIDE the row, never a parent `gap` (a gap outlives a 0px child until unmount). If the
removal can be undone, keep the row and show `PersonRow removed onUndo` instead, then
collapse on commit.

## Loading, failure, announce

- Lists: `<SkeletonRows count={3} label="Loading dates" />`.
- Load failure: `<ErrorState onRetry={refetch} retrying={isFetching} />`.
- Failed save: `const { shake, shakeProps } = useShake();` spread `shakeProps`, call `shake()`, AND show the message.
- Saved / removed: `const [msg, announce] = useAnnounce();` + `<AnnounceRegion message={msg} />` once per screen.

## Motion

0.3s ease-in-out (`MOTION_MS`, `MOTION_TRANSITION`). Every animation stops under
`prefers-reduced-motion` (theme.css + `usePrefersReducedMotion`).
