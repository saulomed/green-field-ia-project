import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /**
   * Figma "Trailing icon" slot (`I143:2435;82:6685`) — an adornment rendered
   * inside the field frame, right-aligned (e.g. the password visibility
   * toggle). Figma lets the 40px control overflow the 36px frame, so the slot
   * is positioned rather than laid out.
   */
  trailing?: ReactNode;
};

/** Single-line text input. Mirrors the Figma `TextField` component. */
export function TextField({ className, trailing, ...props }: TextFieldProps) {
  return (
    <div className="relative flex h-9 w-full min-w-[200px] items-center rounded-1 border border-border bg-input-background has-[input:focus-visible]:shadow-focus-ring">
      <input
        className={cn(
          "h-full w-full bg-transparent py-1.5 pl-4 text-body-lg text-foreground outline-none placeholder:text-muted-foreground",
          trailing ? "pr-10" : "pr-2",
          className,
        )}
        {...props}
      />
      {trailing ? (
        <span className="absolute right-2 flex size-6 items-center justify-center">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
