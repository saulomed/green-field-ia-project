import type { Metadata } from "next";
import Link from "next/link";

import { AuthFooter } from "@/components/auth-footer";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form-label";
import { TextField } from "@/components/ui/text-field";

export const metadata: Metadata = {
  title: "Sign in · StreamTube",
  description: "Sign in to your StreamTube account.",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2 border border-border bg-card px-6 py-10">
        <BrandLogo />

        <h1 className="text-center text-heading-h1 text-foreground">Sign in</h1>

        <form className="flex w-full flex-col gap-6">
          <div className="flex w-full flex-col gap-2">
            <FormLabel htmlFor="email">Email address</FormLabel>
            <TextField
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
            />
          </div>

          <div className="flex w-full flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-y-2">
              <FormLabel htmlFor="password">Password</FormLabel>
              <Link
                href="/forgot-password"
                className="rounded-1 text-body-md text-link focus-visible:shadow-focus-ring focus-visible:outline-none"
              >
                Forgot password?
              </Link>
            </div>
            <TextField
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <AuthFooter
          question="Don't have an account?"
          linkLabel="Sign up"
          linkHref="/signup"
        />
      </div>
    </main>
  );
}
