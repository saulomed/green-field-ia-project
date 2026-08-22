import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Figma "Icon button - standard" (Type=Round, Size=Small): 40px round hit area,
// 24px icon slot, invisible container until interacted with.
const iconButtonVariants = cva(
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-opacity outline-none select-none hover:opacity-90 focus-visible:shadow-focus-ring active:opacity-80 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-6 [&_svg]:shrink-0"
)

function IconButton({
  className,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Required — an icon-only control has no accessible name without it. */
    "aria-label": string
  }) {
  return (
    <button
      data-slot="icon-button"
      aria-label={ariaLabel}
      className={cn(iconButtonVariants({ className }))}
      {...props}
    />
  )
}

export { IconButton, iconButtonVariants }
