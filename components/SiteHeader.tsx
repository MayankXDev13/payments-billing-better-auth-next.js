"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SiteHeader() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  return (
    <header className="border-b border-white/8">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl italic text-[#F5F1E8]">
            Ember
          </span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-neutral-500">
            BILLING
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/pricing"
            className="text-neutral-400 transition hover:text-[#F5F1E8]"
          >
            Pricing
          </Link>
          {isPending ? null : session ? (
            <>
              <Link
                href="/dashboard"
                className="text-neutral-400 transition hover:text-[#F5F1E8]"
              >
                Dashboard
              </Link>
              <button
                onClick={() =>
                  authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => router.push("/login"),
                    },
                  })
                }
                className="rounded-lg border border-white/10 px-4 py-2 text-neutral-300 transition hover:border-orange-500/60 hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white transition hover:bg-orange-600"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
