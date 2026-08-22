import type { SVGProps } from "react";

/**
 * Visible-password state. Exported from the Figma `remove_red_eye` node — the
 * path data is the export verbatim, with `fill` rebound to `currentColor`.
 *
 * Sizing comes from the caller (`size-*`); the icon declares no intrinsic width.
 */
export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 22 15" fill="none" aria-hidden focusable="false" {...props}>
      <path
        d="M11 0C6 0 1.73 3.11 0 7.5C1.73 11.89 6 15 11 15C16 15 20.27 11.89 22 7.5C20.27 3.11 16 0 11 0ZM11 12.5C8.24 12.5 6 10.26 6 7.5C6 4.74 8.24 2.5 11 2.5C13.76 2.5 16 4.74 16 7.5C16 10.26 13.76 12.5 11 12.5ZM11 4.5C9.34 4.5 8 5.84 8 7.5C8 9.16 9.34 10.5 11 10.5C12.66 10.5 14 9.16 14 7.5C14 5.84 12.66 4.5 11 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Hidden-password state. **Design gap**: no `visibility_off` node exists
 * anywhere in the Figma file's Material Icons library (only `remove_red_eye`
 * is present) — see phase-02-auth-frontend progress.md for SI-02.0.4. Path
 * data is the standard Material Symbols "visibility_off" glyph (same design
 * language as the rest of this icon set), pending a real Figma export.
 */
export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...props}>
      <path
        d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.42-.08.65 0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
        fill="currentColor"
      />
    </svg>
  );
}
