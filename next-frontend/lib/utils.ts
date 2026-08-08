import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The Figma text styles compile to `text-*` utilities (`text-label-lg`,
 * `text-heading-h1`, …). tailwind-merge only knows its built-in size scale, so
 * it files these under `text-color` and treats them as conflicting with real
 * colour utilities — silently dropping `text-primary-foreground` from
 * `cn("text-primary-foreground", "text-label-lg")`.
 *
 * Registering them as font sizes puts each in its own group again.
 * `text-overlay` is deliberately absent: `--color-overlay` shadows
 * `--text-overlay`, so that class really is a colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "heading-h1",
            "heading-h2",
            "heading-h3",
            "body-lg",
            "body-md",
            "caption",
            "label-md",
            "label-lg",
            "label-xl",
            "label-2xl",
            "helper",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
