import { SiteHeader } from "@/components/SiteHeader"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import Image from "next/image"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect("/login")
  }

  const { user } = session

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rise">
          <p className="font-mono text-xs tracking-[0.25em] text-orange-400/90">
            PROFILE
          </p>
          <h1 className="mt-4 font-display text-5xl text-[#F5F1E8]">
            The <em>account</em> behind the ledger.
          </h1>
        </div>

        <section
          className="rise mt-10 flex items-center gap-6 rounded-3xl border border-white/8 bg-[#131316] p-8"
          style={{ animationDelay: "120ms" }}
        >
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || "User avatar"}
              width={64}
              height={64}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-orange-500/15 font-display text-2xl italic text-orange-300">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-3xl text-[#F5F1E8]">
              {user.name}
            </p>
            <p className="mt-2 font-mono text-sm break-all text-neutral-500">
              {user.email}
            </p>
            <p className="mt-1 font-mono text-xs break-all text-neutral-600">
              ID {user.id}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
