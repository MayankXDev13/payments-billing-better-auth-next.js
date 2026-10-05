"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Github } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import type { OAuthProvider } from "@/app/login/page";

const LoginForm = ({ providers }: { providers: OAuthProvider[] }) => {
  const signIn = (provider: OAuthProvider) =>
    authClient.signIn.social({ provider, callbackURL: "/dashboard" });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090b] p-4">
      {/* One quiet glow, then restraint. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[60vh] w-[80vw] -translate-x-1/2 rounded-full bg-orange-500/10 blur-[120px]"
      />
      <Card className="rise w-full max-w-md border-white/8 bg-[#131316]/90 text-neutral-200 backdrop-blur">
        <CardHeader className="text-center">
          <p className="font-mono text-[11px] tracking-[0.25em] text-orange-400/90">
            SIGN IN
          </p>
          <CardTitle className="mt-3 font-display text-4xl font-normal italic text-[#F5F1E8]">
            Welcome back
          </CardTitle>
          <CardDescription className="text-neutral-400">
            Your ledger is waiting. Pick a way in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.includes("google") && (
            <Button
              onClick={() => signIn("google")}
              variant="outline"
              className="h-12 w-full border-white/10 bg-transparent text-base text-neutral-200 transition hover:border-orange-500/60 hover:text-white"
            >
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          )}

          {providers.includes("github") && (
            <Button
              onClick={() => signIn("github")}
              variant="outline"
              className="h-12 w-full border-white/10 bg-transparent text-base text-neutral-200 transition hover:border-orange-500/60 hover:text-white"
            >
              <Github className="mr-3 h-5 w-5" />
              Continue with GitHub
            </Button>
          )}

          {providers.length === 0 && (
            <p className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center text-sm text-yellow-200">
              No sign-in provider is configured. Add OAuth credentials in{" "}
              <span className="font-mono">.env</span> first.
            </p>
          )}

          <p className="pt-2 text-center text-xs text-neutral-600">
            Test mode — signing in charges nothing.{" "}
            <Link href="/pricing" className="underline hover:text-neutral-400">
              See plans
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
