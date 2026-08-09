> Part of the `testing-guide-next-frontend` skill (see `../SKILL.md`).

# Icon Components (`components/icons/*.tsx`)

Icon components render an inline `<svg>` with hardcoded paths, `viewBox` from the source SVG, `currentColor` fills, `aria-hidden="true"`, and `...props` spread onto the root. They do not branch, do not hold state, do not handle events. They are hand-maintained and re-exported from `components/icons/index.ts` — there is no external icon library (`lucide-react` was deliberately removed), so nothing here is third-party code.

## What to test

Nothing. Asserting that `<StreamTubeIcon />` renders an `<svg>` element with a particular `<path d=...>` is the textbook mirror test — the assertion copies the implementation. It does not catch any bug a developer could realistically introduce; if the `d` attribute changes, the visual changes, which is a design review concern, not a test concern.

## Layer assignment

| Icon shape | Vitest | E2E |
|---|---|---|
| Plain SVG component (the only kind in this project) | ❌ skip | covered indirectly via consumers |

## Setup pattern

None.

## When to skip

Always.

## Examples from this project

- `components/icons/spinner.tsx` — renders a `<svg>` with static paths, re-exported from `components/icons/index.ts`. **Skip.** Its consumers (loading states on buttons and forms) are exercised via Playwright on the rendered page.

## If you want to verify icons visually

Use a Playwright visual snapshot of the page that consumes the icon, not a Vitest test on the icon itself.
