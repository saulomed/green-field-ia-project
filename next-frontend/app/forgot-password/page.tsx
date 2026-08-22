import type { Metadata } from "next";
import Link from "next/link";

import { AuthFooter } from "@/components/auth-footer";
import { BrandLogo } from "@/components/brand-logo";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { ArrowBackIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reset password · StreamTube",
  description: "Request a link to reset your StreamTube password.",
};

/**
 * `/forgot-password` — anonymous route (`### Authorization Matrix`), no session
 * guard. Mirrors the Figma node `140:289`, whose frame and `<h1>` read "Reset
 * password" even though the content is only the *request* step; the reset
 * screen itself is deferred, and no `/reset-password` route exists.
 *
 * **Two copy calls the design got wrong**, both flagged in the inventory and
 * corrected here rather than reproduced verbatim. The design owner has since
 * confirmed the Figma nodes are the side that needs fixing:
 *
 * - The Figma `AuthFooter` (`2394:2276`) pairs "Remember your password?" with a
 *   "Sign up" link. Someone who remembered their password wants to sign in, so
 *   the link reads "Sign in" and points at `/login`.
 * - The back arrow (`143:2343`) has no destination in the design. `/login` is
 *   the only screen that links here, so that is where back goes.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Card className="relative w-full max-w-md min-w-[280px] items-center gap-6 px-6 py-10">
        <Link
          href="/login"
          aria-label="Go back"
          className="absolute left-4 top-4 rounded-1 text-foreground focus-visible:shadow-focus-ring focus-visible:outline-none"
        >
          <ArrowBackIcon className="size-6" />
        </Link>

        <BrandLogo />

        <ForgotPasswordForm />

        <AuthFooter
          question="Remember your password?"
          linkLabel="Sign in"
          linkHref="/login"
        />
      </Card>
    </main>
  );
}
