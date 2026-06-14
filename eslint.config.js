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

// `local/no-bare-lazy-imports` — every code-split import must route through
// `lazyWithRetry` (src/lib/lazyWithRetry.ts) so a stale-chunk failure after a
// Vercel deploy is healed identically everywhere. A bare `lazy(() => import(...))`
// — especially nested inside an already-lazy component — bypasses that healing
// and hits the error boundary (BACHATA-WEBSITE-1/-3/-7/-11). lazyWithRetry.ts is
// the one allowed caller of `lazy()`.
const ALLOWED_BARE_LAZY_FILES = ["src/lib/lazyWithRetry.ts"];

const noBareLazyImportsRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Forbid bare React.lazy()/lazy() outside lazyWithRetry.ts — route code-split imports through lazyWithRetry so stale-chunk failures after a deploy self-heal.",
    },
    schema: [],
    messages: {
      bareLazy:
        "Bare lazy() — use lazyWithRetry() from '@/lib/lazyWithRetry' instead so a stale chunk after a deploy triggers a reload rather than an error boundary. For on-demand library import() calls use safeDynamicImport().",
    },
  },
  create(context) {
    const filename = (context.filename || context.physicalFilename || context.getFilename?.() || "").replace(/\\/g, "/");
    if (ALLOWED_BARE_LAZY_FILES.some((p) => filename.endsWith(p))) return {};
    return {
      CallExpression(node) {
        const callee = node.callee;
        // lazy(...)
        if (callee.type === "Identifier" && callee.name === "lazy") {
          context.report({ node, messageId: "bareLazy" });
          return;
        }
        // React.lazy(...)
        if (
          callee.type === "MemberExpression" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "lazy"
        ) {
          context.report({ node, messageId: "bareLazy" });
        }
      },
    };
  },
};

// `local/react-query-default-or-chain` — a `const { data: X } = useQuery(...)`
// (or useInfiniteQuery/useSuspenseQuery) whose `data` has NO destructure default
// is `undefined` on first render; indexing it then throws (BACHATA-WEBSITE-1M:
// `nextEventDates[org.id]`). To stay HIGH-SIGNAL it flags ONLY the binding that is
// actually used as a non-optional COMPUTED index `X[expr]` — the exact crash
// pattern — and leaves optional-chained / dot-access / nullable-typed uses alone
// (they were the bulk of false positives). Fix = add `= []`/`= {}` or optional-
// chain the index. Fires at WARN.
const reactQueryDefaultRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a destructure default for useQuery data (const { data: X = [] } = useQuery(...)) so it is never undefined on first render.",
    },
    schema: [],
    messages: {
      needsDefault:
        "useQuery `data` destructured without a default — add `= []`/`= {}` (or optional-chain every use). Undefined-on-first-render indexing crashed Organisers (BACHATA-WEBSITE-1M).",
    },
  },
  create(context) {
    const QUERY_HOOKS = new Set([
      "useQuery",
      "useInfiniteQuery",
      "useSuspenseQuery",
      "useSuspenseInfiniteQuery",
    ]);
    const sourceCode = context.sourceCode || context.getSourceCode();
    // True when the binding is the object of a NON-optional COMPUTED member access
    // `X[expr]` — the exact undefined-index crash. Optional chaining (`X?.[...]`)
    // and dot access are intentionally NOT flagged.
    const usedAsComputedIndex = (variable) =>
      variable.references.some((ref) => {
        const id = ref.identifier;
        const p = id.parent;
        return (
          p &&
          p.type === "MemberExpression" &&
          p.object === id &&
          p.computed === true &&
          p.optional !== true
        );
      });
    return {
      VariableDeclarator(node) {
        // init must be a call to a query hook
        const init = node.init;
        if (!init || init.type !== "CallExpression") return;
        const callee = init.callee;
        const name =
          callee.type === "Identifier"
            ? callee.name
            : callee.type === "MemberExpression" && callee.property.type === "Identifier"
              ? callee.property.name
              : null;
        if (!name || !QUERY_HOOKS.has(name)) return;
        if (node.id.type !== "ObjectPattern") return;
        const declared = sourceCode.getDeclaredVariables(node);
        for (const prop of node.id.properties) {
          if (prop.type !== "Property") continue;
          if (prop.key.type !== "Identifier" || prop.key.name !== "data") continue;
          // `data: X = default` is an AssignmentPattern → already safe.
          if (prop.value.type === "AssignmentPattern") continue;
          // Only `data` (shorthand) or `data: X` bind a plain identifier we can
          // trace; anything else (nested pattern) we can't reason about → skip.
          if (prop.value.type !== "Identifier") continue;
          const variable = declared.find((v) => v.name === prop.value.name);
          if (variable && usedAsComputedIndex(variable)) {
            context.report({ node: prop, messageId: "needsDefault" });
          }
        }
      },
    };
  },
};

const localPlugin = {
  rules: {
    "no-bare-avatar-images": noBareAvatarImagesRule,
    "no-bare-lazy-imports": noBareLazyImportsRule,
    "react-query-default-or-chain": reactQueryDefaultRule,
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
    "local/no-bare-lazy-imports": "warn",
    "local/react-query-default-or-chain": "warn",
  },
});
