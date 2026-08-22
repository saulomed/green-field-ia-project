import type { Metadata } from "next";

import { AuthFooter } from "@/components/auth-footer";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in · StreamTube",
  description: "Sign in to your StreamTube account.",
};

/**
 * `/login` — anonymous route (`### Authorization Matrix`), no session guard.
 * Mirrors the Figma node `138:179`: the `Card` (`143:1250`) frames the whole
 * column and everything stacks at 24px. Unlike `/signup` there is no back
 * arrow in the design.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md min-w-[280px] items-center gap-6 px-6 py-10">
        <BrandLogo />

        <h1 className="text-center text-heading-h1 text-foreground">Sign in</h1>

        <LoginForm />

        <AuthFooter
          question="Don't have an account?"
          linkLabel="Sign up"
          linkHref="/signup"
        />
      </Card>
    </main>
  );
}
