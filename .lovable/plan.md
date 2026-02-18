

## Redesign the "Partner Intent" Card into a Fun "Practice Buddy" Section

### Goal
Replace the current partner-intent card (section 4, lines 227-260) with a vibrant, fun "Practice Buddy" section that feels energetic and sport-like -- not like a dating profile.

### What Changes

**File: `src/components/profile/DancerProfileGrid.tsx`**

1. **Rename and restyle the section** -- replace the Heart icon and "Open to Partnering" language with dance-practice-focused branding:
   - Header: a fun emoji-based title like "Practice Buddy" with a `Zap` or `Users` icon (no hearts)
   - Background: gradient using teal/cyan tones (energetic, sporty) instead of the current subtle card

2. **Expand `hasPartnerIntent`** (line 86) to also check `partnerSearchLevel.length > 0` and `partnerDetailsText`

3. **New card layout (full 2-col span)**:
   - **Status badge**: Green "Down to Practice!" when `lookingForPartner` is true, or gray "Not right now" -- styled as a fun pill
   - **Preferred role**: Show `partnerSearchRole` as a small labeled chip (e.g., "Looking for: Leader")
   - **Level preferences**: Show `partnerSearchLevel` entries as colored badges (e.g., teal "Beginner", cyan "Advanced") labeled "Vibes with:"
   - **Practice goals**: Keep existing `partnerPracticeGoals` chips but restyle with energetic colors (green/teal borders)
   - **Details note**: Render `partnerDetailsText` as a short italic muted paragraph (max 3 lines, line-clamp) if non-empty

4. **Remove the Heart icon** in the top-right corner; replace with a playful dancing-related icon (`Zap` or `Sparkles`)

### Visual Tone
- Teal/green/cyan palette (energetic, sporty)
- No hearts or pink tones in this section
- Zap/Sparkles icons to convey energy
- Copy like "Down to Practice!", "Vibes with:", "Goals:" -- casual and fun

### No Other File Changes
All data fields (`partnerSearchLevel`, `partnerDetailsText`, `lookingForPartner`, `partnerPracticeGoals`, `partnerSearchRole`) are already available in the `DancerPublicViewModel` passed to this component.

