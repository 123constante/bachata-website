import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// F.1.c — `local/no-bare-avatar-images`.
//
// Flags <img> elements whose className contains the literal `rounded-full`
// outside of the small allowlist of files that are *allowed* to render bare
// avatars (the PersonChip / PeopleStack primitives, profile-editor surfaces
// where the user is editing THEIR OWN avatar, etc.). Fires at WARN so
// existing legitimate cases don't break the build — the warnings are the
// list-of-things-to-look-at, not a hard gate.
const ALLOWED_BARE_AVATAR_FILES = [
  // Design-system primitive — every other people surface routes through this.
  "src/modules/event-page/bento/blocks/schedule/PersonChip.tsx",
  // Internal Avatar helper used by inline-row + chip-overlap variants. Both
  // render bare circles intentionally (overlap stack); they live next to the
  // primitive and don't escape the schedule render tree.
  "src/modules/event-page/bento/blocks/schedule/PeopleStack.tsx",
  // Self-edit avatars on profile / dashboard surfaces — viewers editing their
  // OWN avatar, not discovering someone else.
  "src/components/profile/AvatarUpload.tsx",
  "src/components/profile/DancerDashboard.tsx",
  "src/components/profile/VendorDashboard.tsx",
  "src/components/profile/ProfileSection.tsx",
  // Auth + onboarding flows — the avatar shown is the signed-in user's own.
  "src/components/auth/ProfileEntryFlow.tsx",
  "src/components/MagicLinkConfirmation.tsx",
  "src/pages/CreateProfile.tsx",
  // Decorative / non-person uses — bottom nav, dock, brand assets.
  "src/components/BottomNav.tsx",
  "src/components/experience/FloatingDock.tsx",
  "src/components/HeroCarousel.tsx",
  "src/components/FloatingElements.tsx",
  // Marketing widgets — hardcoded "top teachers / top DJs / dancers" mock
  // data on the landing page. No real navigation, no telemetry needed.
  "src/components/MobileWidgets.tsx",
  // Static testimonial author thumbnails — no profile destination.
  "src/components/TestimonialsSection.tsx",
  // OrganiserCardBlock has its own bespoke pill/multi-target tile design and
  // wires `record_organiser_card_click_v1` directly; converting to PersonChip
  // would break the layout. Telemetry is already shipped here.
  "src/modules/event-page/bento/blocks/OrganiserCardBlock.tsx",
  // Classic-page OrganiserPill — bespoke gold-pill-with-chevron design.
  // emitProfileView wired inline below; visual stays bespoke.
  "src/modules/event-page/sections/EventHeroMetaBlock.tsx",
  // PracticePartners listing — community-driven partner cards with
  // emoji-fallback avatars. Avatar size mismatch + emoji fallback stop a
  // clean PersonChip rollout in this iteration.
  "src/pages/PracticePartners.tsx",
  // Dancers listing already wires emitProfileView; uses motion.div wrapper
  // around img-or-emoji-fallback that PersonChip can't replicate without
  // extra knobs. Telemetry already shipped — visual stays bespoke.
  "src/pages/Dancers.tsx",
];

const noBareAvatarImagesRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Discourage rendering avatar-like <img> elements (rounded-full) outside the PersonChip primitive. People-naming surfaces should route through <PersonChip /> so click telemetry, hit area, and dim-on-unlinked behaviour stay consistent.",
    },
    schema: [],
    messages: {
      bareAvatar:
        "Bare <img class=\"...rounded-full...\"> outside the PersonChip primitive — route through <PersonChip /> for hit-area / telemetry / unlinked-mode consistency. If this is a legitimate non-person use, add the file to ALLOWED_BARE_AVATAR_FILES in eslint.config.js.",
    },
  },
  create(context) {
    const filename = (context.filename || context.physicalFilename || context.getFilename?.() || "").replace(/\\/g, "/");
    const isAllowed = ALLOWED_BARE_AVATAR_FILES.some((p) => filename.endsWith(p));
    if (isAllowed) return {};
    return {
      JSXOpeningElement(node) {
        if (!node.name || node.name.type !== "JSXIdentifier" || node.name.name !== "img") return;
        for (const attr of node.attributes) {
          if (attr.type !== "JSXAttribute") continue;
          if (!attr.name || attr.name.name !== "className") continue;
          // string literal: className="..."
          if (attr.value && attr.value.type === "Literal" && typeof attr.value.value === "string") {
            if (attr.value.value.includes("rounded-full")) {
              context.report({ node, messageId: "bareAvatar" });
            }
            return;
          }
          // expression: className={"... rounded-full"} — best-effort static scan.
          if (
            attr.value &&
            attr.value.type === "JSXExpressionContainer" &&
            attr.value.expression
          ) {
            const expr = attr.value.expression;
            if (expr.type === "Literal" && typeof expr.value === "string" && expr.value.includes("rounded-full")) {
              context.report({ node, messageId: "bareAvatar" });
            } else if (expr.type === "TemplateLiteral") {
              const joined = expr.quasis.map((q) => q.value.cooked || "").join(" ");
              if (joined.includes("rounded-full")) {
                context.report({ node, messageId: "bareAvatar" });
              }
            }
            return;
          }
        }
      },
    };
  },
};

const localPlugin = {
  rules: {
    "no-bare-avatar-images": noBareAvatarImagesRule,
  },
};

export default tseslint.config({ ignores: ["dist", "storybook-static", "**/*.timestamp-*.mjs"] }, {
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
    "local": localPlugin,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "@typescript-eslint/no-unused-vars": "off",
    "local/no-bare-avatar-images": "warn",
  },
});
