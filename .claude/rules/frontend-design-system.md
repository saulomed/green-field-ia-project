---
paths:
  - 'next-frontend/**/*.tsx'
  - 'next-frontend/**/*.css'
description: 'StreamTube design system: Figma as source of truth, token layers, theming policy and component conventions for the Next.js frontend'
---

# Design System Rules — `next-frontend`

## Source of Truth

- Figma file **FC-Tube** — `fileKey: btF0MZVd48p33ufSP08RrX` (`https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube`). No branch: `branchKey` is null.
- Figma defines tokens, text styles, effect styles and component variants. `next-frontend/app/globals.css` is the **generated mirror**, not an independent source. Never invent a token in CSS that has no Figma counterpart — the next audit will report it as drift.
- Never hand-edit the token blocks in `globals.css`. Run `/figma-audit-tokens` (writes `docs/figma-audit.json`), then `/figma-apply-tokens-tailwind-v4`. Manual edits break the `css_file_sha` check and force a re-audit.
- The Figma library is **not published**: `search_design_system` returns no components and there is no Code Connect map. Discover components by node URL + `get_design_context`, not by library search.
- The Figma MCP runs on a Starter plan with a hard tool-call ceiling. Prefer one `get_design_context` call on a parent node over many per-variant calls; when a large node truncates, re-request only the missing sub-nodes.

## Token Layers

Three layers, in binding order. A component binds the **most semantic layer available**.

| Layer | Figma | CSS | Use in components |
|---|---|---|---|
| Primitives | collection `Primitives` (`red/*`, `neutral/*`, `spacing/*`, `radius/*`) | `@theme inline` raw ramps | **Never** — they exist to feed the semantic layer |
| Semantic | collection `Theme` (Light/Dark modes) | `:root` + dark `@media`, re-exported as `--color-*` | **Always** — `bg-primary`, `text-foreground`, `border-border` |
| Composite | text + effect styles | `--text-*`, `--shadow-*` | `text-label-md`, `shadow-focus-ring` |

- Semantic color utilities: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `input`, `input-background`, `ring`, `link`, `overlay`, `progress-track`, `sidebar-*`, `chart-1..5` — each with its `-foreground` pair where one exists.
- Never write a raw hex, `rgb()`, `oklch()` or an arbitrary `[#…]` value in a component. If Figma shows a colour with no semantic token behind it, that is a Figma gap — report it, do not hardcode around it.
- Primitive ramps `red-*`, `blue-*`, `neutral-*`, `almost-black-*`, `error-*`, `warning-*`, `success-*` are reachable as utilities but are **out of bounds in components**.
- `--color-red-*: initial`, `--color-blue-*: initial` and `--color-neutral-*: initial` in `@theme inline` deliberately clear Tailwind's built-ins so Figma owns those ramps end to end. Do not delete them — without the reset, undefined steps silently fall back to Tailwind's palette.

## Theming Policy

- Light lives in `:root`. Dark lives in `@media (prefers-color-scheme: dark) :root`. There is **no `.dark` class** and no `@custom-variant dark` — the `dark:` variant stays on Tailwind's default so utilities and token blocks flip together.
- Both blocks must declare the **same keys in the same order**. `--radius` is the one intentional light-only exception (shape, not colour).
- Theme colour values must be 6- or 8-digit lowercase hex.
- `npm run check:tokens` enforces all of the above. Run it after any `globals.css` change and after `npx shadcn add`, which happily reintroduces an oklch palette and a `.dark` block.

## Typography

- Figma text styles map 1:1 to `text-*` utilities that already carry size, line-height and weight. Set the utility and nothing else — no companion `leading-*` or `font-*`.

| Figma style | Utility | px / lh / weight |
|---|---|---|
| `Inter/Display` | `text-display` | 30 / 36 / 700 |
| `Inter/Heading/H1..H3` | `text-heading-h1..h3` | 24/32/700 · 20/28/600 · 18/28/600 |
| `Inter/Body/LG` · `MD` | `text-body-lg` · `text-body-md` | 16/24/400 · 14/20/400 |
| `Inter/Label/MD` · `LG` · `XL` · `2XL` | `text-label-md` · `-lg` · `-xl` · `-2xl` | 14/20/500 · 16/24/500 · 24/32/400 · 32/40/400 |
| `Inter/Caption` · `Helper` | `text-caption` · `text-helper` | 12/18/400 · 12/16/400 |
| `Inter/Overlay` | ⚠️ unreachable — see below | 16/20/400 |

- **Every typography utility must be registered in `lib/utils.ts`.** `tailwind-merge` only knows its own size scale; anything else matching `text-*` it files as a *colour*. Unregistered, `cn("text-primary-foreground", "text-label-lg")` returns only `text-label-lg` — the colour is silently dropped and the text falls back to `--foreground` (white-on-white in dark mode). `cn` therefore uses `extendTailwindMerge` with the custom sizes listed under `font-size`. **When a new `--text-*` token lands in Figma, add it to that list in the same change**, or every component that combines it with a colour will render uncoloured.
- **`text-overlay` is a name collision, not a type utility.** `--color-overlay` (semantic) and `--text-overlay` (type style) both claim `text-overlay`, and the colour wins: the class compiles to `color: var(--overlay)` alone. To apply the Overlay type style you must spell it out (`text-[length:var(--text-overlay)] leading-[var(--text-overlay--line-height)]`). Rename one side in Figma to fix it properly.
- Font family comes from `next/font` in `app/layout.tsx` (`--font-inter` → `--font-sans`). Never import a font in CSS.

## Shape and Spacing

- Radius — the reachable Figma scale is `rounded-none` (0), `rounded-1` (4px), `rounded-2` (8px), `rounded-3` (12px), `rounded-4` (16px), `rounded-full` (999px). Use these.
- **Fractional radius tokens are dead.** Tailwind does not translate `-0-5`/`-1-5` into `.0.5`/`.1.5`, so `--radius-0-5` (2px) and `--radius-1-5` (6px) have no utility at all — `rounded-0.5` and `rounded-1.5` compile to nothing. If a design needs them, write `rounded-[var(--radius-1-5)]`.
- **Two unrelated radius systems coexist.** `rounded-sm|md|lg|xl|2xl|3xl|4xl` are shadcn `calc()` leftovers off `--radius: 0.625rem` and have nothing to do with Figma. `--radius-5`/`--radius-6` are literal `5px`/`6px`, breaking the ×4 pattern of their neighbours. Stick to the numeric Figma names; never mix systems in one component.
- Spacing: `--spacing-*` mirrors Figma in px and lines up with Tailwind's built-in 4px step, so `px-4`, `gap-2`, `p-20` resolve to 16/8/80px as designed. Fractional steps (`py-1.5`, `gap-2.5`) resolve through Tailwind's `--spacing` multiplier rather than the named token, but land on the same value. Use the named steps; no arbitrary `[12px]`.
- Elevation: `shadow-card`, `shadow-drawer-left`, `shadow-button-focus`, `shadow-showcase-card`, `shadow-focus-ring`.

### Broken theme keys — never build utilities on these

`globals.css` mirrors three primitive families that land in the wrong Tailwind namespace. They exist only so the audit reports zero drift; delete them in **Figma** if you want them gone.

- `--shadow-y-*`, `--shadow-blur-*`, `--shadow-spread-*` — unitless numbers in the `--shadow-*` namespace. `shadow-y-xs` emits `box-shadow: 1` and **erases** the element's shadow. Use the composed `shadow-*` styles.
- `--font-size-*` — v4 uses `--text-*`; `text-12` generates nothing.
- `--line-height-*` — v4 uses `--leading-*`. Worse, the name stays valid via the spacing scale, so `leading-24` resolves to **96px**.

## Components

### shadcn primitives must be reconciled with Figma

`npx shadcn add` produces a **scaffold, not the design.** Its defaults — `h-8`, `rounded-md`, its own variant names, its own focus ring, its own colour choices — come from shadcn's house style and do not match FC-Tube.

- **Whenever a shadcn primitive is used and Figma has a matching component, the primitive MUST be rewritten to the Figma spec before any screen consumes it.** Scaffolding a primitive and shipping it on shadcn's defaults is a defect, not a starting point — it silently forks the design system on its first use.
- Reconcile every axis, not just the obvious ones:
  - **Variants** — names and set must match Figma's `Variant=*`. Delete shadcn variants Figma does not define; add the ones it does.
  - **Sizes** — match Figma's `Size=*` names and every value behind them (padding, gap, radius, height, icon size, typography utility). Drop shadcn's extra sizes.
  - **`defaultVariants`** — must equal Figma's default combination.
  - **Colour** — replace every shadcn colour with the semantic token the Figma layer is bound to.
  - **Radius / spacing / typography** — the Figma scales, never shadcn's `rounded-md` / `text-sm` defaults.
  - **States** — `Variant=… State=…` maps to pseudo-classes; keep shadcn's only where Figma agrees.
- `components/ui/button.tsx` is the worked example: variants, sizes, radius step-down on `:active`, `inset-ring-*` strokes and the composite typography utilities all come from the Figma Button, and nothing of shadcn's original styling survived.
- Where Figma has **no** counterpart, keep the shadcn primitive but still bind project tokens — no raw values, no shadcn `calc()` radius — and flag the gap rather than inventing a design.
- **Never re-run `npx shadcn add` over a reconciled primitive.** It overwrites the file and discards the Figma work. If you must, diff the output and port only what you actually want. The same command also rewrites `globals.css` cssVars, so run `npm run check:tokens` afterwards.

### Conventions

- Location: primitives in `next-frontend/components/ui/`, composed app pieces in `next-frontend/components/`. One component per file, named export.
- Variant-bearing primitives use `cva` + `cn` (`@/lib/utils`), Radix `Slot` for `asChild`, and emit `data-slot` / `data-variant` / `data-size` attributes for styling hooks and tests.
- Mirror the Figma variant axes exactly — same names, same values. Figma's `State=*` axis is **not** a prop: `hover`/`focus`/`active`/`disabled` map to `:hover`, `:focus-visible`, `:active`, `:disabled`. Only states with no CSS equivalent (e.g. `loading`) become props.
- Defaults in `defaultVariants` must match Figma's default variant combination.
- Figma strokes are **inside-aligned**, so a bordered variant is the same height as an unbordered one. Reproduce them with `inset-ring-*`, not `border-*` — `border` with `box-sizing: border-box` adds 2px to every bordered variant.
- Do not add `focus-visible` styling per variant. Every interactive element gets `focus-visible:shadow-focus-ring`. Where Figma omits a focus ring (it does, on some low-emphasis variants), add it anyway and flag the gap — an invisible focus state is an accessibility defect, not a style choice.
- Read the Figma component description before implementing: several carry usage constraints and M3 documentation links.

## Icons

- **No external icon library.** `lucide-react` was removed and `components.json` declares no `iconLibrary`. Never add one back, and never `npm install` an icon package to satisfy a design.
- Every icon is a hand-maintained React component in `next-frontend/components/icons/`, one glyph per file (`spinner.tsx` → `SpinnerIcon`), re-exported from `components/icons/index.ts`. Import from the barrel: `import { SpinnerIcon } from "@/components/icons"`.
- Icon component contract:
  - Signature `(props: SVGProps<SVGSVGElement>)`, spreading `{...props}` last so callers can override anything.
  - Keep the `viewBox` from the Figma export. Declare **no** `width`/`height` — the consumer sizes it with `size-*`.
  - Paint with `fill="currentColor"` (or `stroke="currentColor"`) so the glyph follows the surrounding text colour. Never bake a hex or a token into the SVG.
  - Default `aria-hidden` and `focusable="false"`; an icon that carries meaning gets its label from the consumer.
- The path data must be the **Figma export verbatim** — copy the `d` attribute out of the exported SVG and change only the `fill`/`stroke` binding. Never trace a glyph from a screenshot and never redraw one by hand: you do not have the real vector data.
- `get_design_context` returns asset URLs that **expire in ~7 days**. Pull the bytes immediately and transplant them into a component; never ship a `figma.com/api/mcp/asset/...` URL.
- `public/` is for content images (brand mark, illustrations), not for icons. An icon referenced by `<img src>` cannot inherit `currentColor` and will not theme.
- Size icons explicitly on both axes (`size-5`, `size-6`, `size-8`), normally via the parent's `[&_svg]:size-*` so the icon scales with the component's size variant. Never leave a dimension `auto`.
- Components pulled with `npx shadcn add` arrive with `lucide-react` imports. Replace them with `components/icons` equivalents before committing — the dependency is not installed, so the import will not resolve.

## Design → Code Workflow

1. Load the `figma:figma-design-to-code` skill **before** calling `get_design_context`.
2. Call `get_design_context` on the node; treat its React+Tailwind output as a reference, never as code to paste.
3. Translate `var(--token, #fallback)` to the project utility for that token. A surviving hex fallback in the final code means the mapping was not done.
4. Reuse existing components and tokens before creating anything new.
5. Verify with `npx tsc --noEmit`, `npm run lint` and `npm run check:tokens`; when layout or token resolution is in question, render the page and inspect the compiled CSS rather than assuming a utility exists.
6. Report every deviation from the design and its reason. Do not silently "fix" the design in code.
