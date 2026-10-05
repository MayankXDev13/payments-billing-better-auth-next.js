import LoginForm from "@/components/login-form";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

export type OAuthProvider = "google" | "github";

const LoginPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!!session) {
    redirect("/");
  }

  // Only offer providers that are actually configured — an empty client id
  // would send the user into a broken OAuth flow.
  const providers: OAuthProvider[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push("google");
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push("github");
  }

  return (
    <div>
      <LoginForm providers={providers} />
    </div>
  );
};

export default LoginPage;
