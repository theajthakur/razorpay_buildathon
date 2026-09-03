import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./global.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShopAgent — Merchant Dashboard",
  description: "Securely manage settings, explore integration guides, and track order payouts for your ShopAgent AI shopping agent store.",
};

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="bg-background text-text-primary font-sans text-base leading-relaxed min-h-full flex flex-col">
        <ClerkProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "font-sans border border-border bg-surface text-text-primary rounded-xl shadow-lg p-4",
            }}
          />
        </ClerkProvider>
      </body>
    </html>
  );
}
