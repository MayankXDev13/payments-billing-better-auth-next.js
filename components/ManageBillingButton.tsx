"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await response.json()) as {
        url?: string;
        error?: string;
        code?: string;
      };

      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.code === "NO_CUSTOMER" || data.code === "CUSTOMER_DELETED") {
        window.location.assign("/pricing");
        return;
      }
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      setError(data.error ?? "Couldn't open billing. Try again.");
    } catch (err) {
      console.error(err);
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <button
        onClick={openPortal}
        disabled={pending}
        className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
