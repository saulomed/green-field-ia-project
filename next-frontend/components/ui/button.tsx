import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { SpinnerIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Figma draws the outline/secondary stroke *inside* the frame, so sm/md/lg keep
  // their 36/40/44px heights. `inset-ring-*` reproduces that (box-shadow, no layout
  // cost) instead of `border-*`, which would push every bordered variant 2px taller.
  "group/button relative inline-flex min-w-20 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap transition-[opacity,border-radius,box-shadow] duration-150 outline-none select-none hover:opacity-90 focus-visible:shadow-focus-ring active:opacity-80 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50 data-[loading=true]:pointer-events-none data-[loading=true]:opacity-70 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline:
          "text-foreground inset-ring-1 inset-ring-foreground disabled:inset-ring-border",
        secondary:
          "bg-secondary text-foreground inset-ring-1 inset-ring-border",
        ghost: "text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        link: "text-link",
      },
      // The radius shrinks one step on `:active` — that squeeze is the press
      // affordance in the Figma spec, not a leftover from the resting style.
      size: {
        sm: "gap-2 rounded-3 px-4 py-2 text-label-md active:rounded-2 [&_svg]:size-5",
        md: "gap-2 rounded-4 px-6 py-2 text-label-lg active:rounded-3 [&_svg]:size-6",
        lg: "gap-3 rounded-full px-12 py-1.5 text-label-xl active:rounded-4 [&_svg]:size-8",
      },
    },
    compoundVariants: [
      // Only the large outline button uses a 2px stroke.
      { variant: "outline", size: "lg", class: "inset-ring-2" },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "md",
  asChild = false,
  loading = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Renders the Figma `loading` state: the button dims to 70%, stops
     * responding to pointer input and grows a leading spinner while keeping its
     * label. Ignored when `asChild` is set, since `Slot` accepts a single child.
     */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <SpinnerIcon data-slot="button-spinner" className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
