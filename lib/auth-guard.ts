import { auth } from "@/lib/auth";
import { Session } from "better-auth";
import { NextRequest } from "next/server";

export async function requireAuth(
  request: NextRequest
): Promise<NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
