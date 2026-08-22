import type { Metadata } from "next";
import Link from "next/link";

import { AuthFooter } from "@/components/auth-footer";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowBackIcon } from "@/components/icons";
import { SignupForm } from "@/components/signup-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create account · StreamTube",
  description: "Create your StreamTube account and start sharing.",
};

/**
 * `/signup` — anonymous route (`### Authorization Matrix`), no session guard.
 * Mirrors the Figma node `140:333`: the `Card` frames the whole column, the
 * back arrow floats over its top-left corner, and everything else stacks at
 * 24px.
 */
export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Card className="relative w-full max-w-md min-w-[280px] items-center gap-6 px-6 py-10">
        <Link
          href="/"
          aria-label="Go back"
          className="absolute left-4 top-4 rounded-1 text-foreground focus-visible:shadow-focus-ring focus-visible:outline-none"
        >
          <ArrowBackIcon className="size-6" />
        </Link>

        <BrandLogo />

        <SignupForm />

        <AuthFooter
          question="Already have an account?"
          linkLabel="Sign in"
          linkHref="/login"
        />
      </Card>
    </main>
  );
}
