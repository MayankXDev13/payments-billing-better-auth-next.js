import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Ember Billing — Stripe subscriptions with Better Auth",
  description:
    "Sign in, pick a plan, pay with Stripe Checkout, and manage your subscription from the dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} bg-[#09090b] text-neutral-200 antialiased`}
      >
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
