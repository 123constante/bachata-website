// DJ contact helpers (W1 S2).

/** A website field that actually holds an Instagram link is the Instagram contact (it printed a bare "www.instagram.com"). */
export const splitInstagramWebsite = (instagram: string | null, website: string | null): { instagram: string | null; website: string | null } => {
  const w = website?.trim();
  if (w && /^(https?:\/\/)?(www\.)?instagram\.com(\/|$)/i.test(w)) {
    return { instagram: instagram?.trim() ? instagram : w, website: null };
  }
  return { instagram, website };
};

