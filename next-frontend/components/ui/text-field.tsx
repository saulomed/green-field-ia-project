import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement>;

/** Single-line text input. Mirrors the Figma `TextField` component. */
export function TextField({ className = "", ...props }: TextFieldProps) {
  return (
    <input
      className={`h-9 w-full rounded-1 border border-border bg-input-background py-1.5 pl-4 pr-2 text-body-lg text-foreground placeholder:text-muted-foreground focus-visible:shadow-focus-ring focus-visible:outline-none ${className}`}
      {...props}
    />
  );
}
