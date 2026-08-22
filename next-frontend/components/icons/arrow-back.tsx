import type { SVGProps } from "react";

/**
 * Back-navigation arrow. Exported from the Figma `arrow_back` node — the path
 * data is the export verbatim, with `fill` rebound to `currentColor`.
 *
 * Sizing comes from the caller (`size-*`); the icon declares no intrinsic width.
 */
export function ArrowBackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden focusable="false" {...props}>
      <path
        d="M3.825 9L9.425 14.6L8 16L0 8L8 0L9.425 1.4L3.825 7H16V9H3.825Z"
        fill="currentColor"
      />
    </svg>
  );
}
