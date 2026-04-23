type MusicStylesRowProps = {
  musicStyles: string[];
};

export const MusicStylesRow = ({ musicStyles }: MusicStylesRowProps) => {
  if (!musicStyles || musicStyles.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {musicStyles.map((style) => {
        // Slugify for display only. Rendered as #hashtag pills.
        const slug = style.trim().toLowerCase().replace(/\s+/g, '-');
        return (
          // TODO: link to site-wide search page once built (~3 days from 22 Apr 2026)
          <a
            key={slug}
            href="#"
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-[6px] text-[12px] font-medium text-white/80 transition hover:bg-white/[0.08]"
          >
            #{slug}
          </a>
        );
      })}
    </div>
  );
};
