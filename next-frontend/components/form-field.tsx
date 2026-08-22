import type { ReactNode } from "react";
import type { FieldError } from "react-hook-form";

import { FormLabel } from "@/components/ui/form-label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  error?: FieldError;
  /** Ids of always-present descriptions (a strength bar, a hint) appended after the error id. */
  describedBy?: string;
  /** Rendered on the label's row, pushed to the far end — e.g. login's "Forgot password?" link. */
  action?: ReactNode;
  children: (a11y: { "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
};

/**
 * Label + control + error message, with the `aria-invalid`/`aria-describedby`
 * wiring derived from the field id rather than spelled out per field — the auth
 * forms would otherwise repeat it once per input, and drift.
 *
 * The control is a render prop so each screen keeps ownership of its input
 * (masked, with a trailing toggle, plain) while the a11y plumbing stays here.
 */
export function FormField({ id, label, error, describedBy, action, children }: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <FormLabel htmlFor={id}>{label}</FormLabel>
        {action}
      </div>
      {children({
        "aria-invalid": error ? true : undefined,
        "aria-describedby": cn(error && errorId, describedBy) || undefined,
      })}
      {error ? (
        <p id={errorId} className="text-caption text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
