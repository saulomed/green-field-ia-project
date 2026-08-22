"use client";

import { useState, type ReactNode } from "react";
import {
  useForm,
  useWatch,
  type Control,
  type FieldError,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormField } from "@/components/form-field";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { SignupSuccessPanel } from "@/components/signup-success-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { ProgressLinear } from "@/components/ui/progress-linear";
import { TextField } from "@/components/ui/text-field";
import type { RegisterBffErrorResponse, RegisterBffRequest, RegisterBffResponse } from "@/lib/api/contracts";
import { ROOT_SERVER_ERROR, resolveErrorField } from "@/lib/forms/error-map";
import { signupSchema, type SignupSchema } from "@/lib/forms/signup-schema";

const STRENGTH_IDS = "password-strength password-strength-hint";

/**
 * Local password-strength heuristic. Never leaves the browser: the bar and the
 * hint are client-side affordances (`### Behaviors` → *Interactions*), and the
 * backend imposes no complexity rule of its own — only 8–128 characters.
 *
 * **Design gap:** the Figma node draws a single state ("Weak password. Add
 * numbers and symbols."). The two stronger copies below are the implementer's
 * call until a design exists.
 */
function passwordStrength(password: string): { value: number; hint: string } {
  if (password.length === 0) {
    return { value: 0, hint: "Use at least 8 characters." };
  }

  const score = [
    password.length >= 8,
    password.length >= 12,
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    /[A-Z]/.test(password),
  ].filter(Boolean).length;

  const value = (score / 5) * 100;

  if (value < 40) return { value, hint: "Weak password. Add numbers and symbols." };
  if (value < 80) return { value, hint: "Fair password. Add symbols to strengthen it." };
  return { value, hint: "Strong password." };
}

/**
 * Subscribes to the password on its own so a keystroke re-renders the bar and
 * the hint instead of the whole form.
 */
function PasswordStrength({ control }: { control: Control<SignupSchema> }) {
  const { value, hint } = passwordStrength(useWatch({ control, name: "password" }));

  return (
    <>
      <ProgressLinear id="password-strength" value={value} aria-label="Password strength" />
      <p id="password-strength-hint" className="text-caption text-warning-text">
        {hint}
      </p>
    </>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  /** Noun the show/hide control refers to, e.g. `"password confirmation"`. */
  subject: string;
  error?: FieldError;
  describedBy?: string;
  registration: UseFormRegisterReturn;
  children?: ReactNode;
};

/** A `FormField` whose control is a masked input with its own visibility toggle. */
function PasswordField({
  id,
  label,
  placeholder,
  subject,
  error,
  describedBy,
  registration,
  children,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} error={error} describedBy={describedBy}>
      {(a11y) => (
        <>
          <TextField
            id={id}
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            placeholder={placeholder}
            trailing={
              <IconButton
                type="button"
                aria-label={`${visible ? "Hide" : "Show"} ${subject}`}
                onClick={() => setVisible((current) => !current)}
              >
                {visible ? <EyeOffIcon /> : <EyeIcon />}
              </IconButton>
            }
            {...a11y}
            {...registration}
          />
          {children}
        </>
      )}
    </FormField>
  );
}

/**
 * Signup form. Mirrors the Figma frame `143:2399` inside node `140:333`.
 *
 * Client Component submitting to the BFF over a relative `fetch`
 * (`auth-frontend/TD-01`, Option A). On `201` the form body is replaced by
 * `<SignupSuccessPanel>` **without leaving `/signup`** (`auth-frontend/TD-09`)
 * — the `201` issues no session cookie, so there is no auto-login to route to.
 *
 * The submitted "Full Name" is persisted as `users.name` and seeds the
 * display name of the Channel created alongside the account.
 */
export function SignupForm() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: { email: "", name: "", password: "", confirmPassword: "" },
  });

  const serverError = errors.root?.serverError?.message;

  async function onSubmit({ email, name, password }: SignupSchema) {
    const body: RegisterBffRequest = { email, name, password };
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 201) {
      const created = (await response.json()) as RegisterBffResponse;
      setRegisteredEmail(created.email);
      return;
    }

    const envelope = (await response.json().catch(() => null)) as RegisterBffErrorResponse | null;

    setError(envelope ? resolveErrorField(envelope.error) : ROOT_SERVER_ERROR, {
      message: envelope?.message ?? "Something went wrong. Please try again.",
    });
  }

  if (registeredEmail !== null) {
    return <SignupSuccessPanel email={registeredEmail} />;
  }

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-6">
        <h1 className="text-center text-heading-h1 text-foreground">Create account</h1>
        <p className="text-center text-body-md text-muted-foreground">
          Join the community and start sharing.
        </p>
      </div>

      {serverError ? (
        <p role="alert" className="text-body-md text-destructive">
          {serverError}
        </p>
      ) : null}

      <FormField id="name" label="Full Name" error={errors.name}>
        {(a11y) => (
          <TextField
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Enter your full name"
            {...a11y}
            {...register("name")}
          />
        )}
      </FormField>

      <FormField id="email" label="Email address" error={errors.email}>
        {(a11y) => (
          <TextField
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            {...a11y}
            {...register("email")}
          />
        )}
      </FormField>

      <PasswordField
        id="password"
        label="Password"
        placeholder="Create password"
        subject="password"
        error={errors.password}
        describedBy={STRENGTH_IDS}
        registration={register("password")}
      >
        <PasswordStrength control={control} />
      </PasswordField>

      <PasswordField
        id="confirmPassword"
        label="Confirm Password"
        placeholder="Confirm your password"
        subject="password confirmation"
        error={errors.confirmPassword}
        registration={register("confirmPassword")}
      />

      <div className="flex items-center gap-2">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
        />
        <label htmlFor="terms" className="text-body-md text-muted-foreground">
          I agree to the <span className="text-link">Terms of Service</span> and{" "}
          <span className="text-link">Privacy Policy</span>
        </label>
      </div>

      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
        disabled={!termsAccepted || !isValid || isSubmitting}
      >
        Create account
      </Button>
    </form>
  );
}
