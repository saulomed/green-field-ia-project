import type { ReactNode } from "react";

type FormLabelProps = {
  htmlFor: string;
  children: ReactNode;
  /** Shows the required asterisk, bound to the `destructive` theme token. */
  required?: boolean;
};

/**
 * Form-field label. Mirrors the Figma `FormLabel` component
 * (Label text + Required properties).
 */
export function FormLabel({ htmlFor, children, required = false }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-0.5 text-body-md text-foreground">
      {children}
      {required ? (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      ) : null}
    </label>
  );
}
