import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Figma "ProgressLinear" (143:2446) — determinate indicator, track + indicator
// bar. Strength is computed by the caller (e.g. the signup form); this
// component only renders the resulting percentage. Built on Radix's Progress
// primitive (already a project dependency, used by Checkbox) instead of a
// hand-rolled `role="progressbar"` div — Radix owns the ARIA wiring.
function ProgressLinear({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Percentage (0–100) of the track the indicator fills. */
  value: number
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress-linear"
      value={value}
      className={cn("relative h-1 w-full overflow-hidden rounded-full bg-progress-track", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-linear-indicator"
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${value}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { ProgressLinear }
