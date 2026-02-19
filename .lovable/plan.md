

## Auth Signup Visual Overhaul: Emerald & Gold + New Logo

### Overview
Update the logo to the uploaded image and apply an Emerald & Gold color scheme exclusively to the auth/signup flow. No logic changes -- only visual styling.

### Logo Update
- Copy `user-uploads://IMG_5823_small.jpg` to `src/assets/bachata-calendar-logo-auth.png` (replacing the current file)
- The logo is already imported and used in Auth.tsx, so it will update automatically

### Emerald & Gold Color Scheme
Apply a scoped color palette to the auth page only (no changes to the global theme or other pages).

**Palette:**
- Background: Deep dark green-black (`#0a1a14` / `#0d1f17`)
- Card: Dark emerald glass (`rgba(16, 42, 32, 0.85)`)
- Primary accent: Emerald green (`#34d399` / `#10b981`)
- Secondary accent: Soft gold (`#fbbf24` / `#f59e0b`)
- Glow orbs: Emerald and gold blurs behind the card
- Text: White foreground, muted sage for secondary text
- Borders: Emerald-tinted borders (`emerald-500/30`)

**What changes in `src/pages/Auth.tsx`:**
- Wrapper div gets inline background style (deep dark green) or a scoped class
- Ambient glow orbs switch from primary/accent to emerald and gold colors
- Card styling: emerald-tinted border, slightly green-tinted glass background
- Tab toggle: active tab uses emerald gradient instead of `bg-primary`
- Progress bar gradient: emerald-to-gold instead of primary-to-accent
- All CTA buttons: emerald-to-gold gradient (`from-emerald-500 to-amber-400`)
- Role card selected state: emerald border and emerald background tint
- Input focus rings: emerald tint
- Logo glow: emerald drop-shadow instead of primary
- "gradient-text" on the heading replaced with a custom emerald-to-gold gradient

### Files Changed
- `src/assets/bachata-calendar-logo-auth.png` -- replaced with new logo
- `src/pages/Auth.tsx` -- all color references updated (Tailwind utility classes only, no CSS variable changes)

### What Does NOT Change
- Global theme variables in `index.css` (the rest of the app keeps orange/gold)
- Signup flow logic, steps, validation, Supabase calls
- MobileBottomNav auth modal (separate task if needed)
- Any other page or component

