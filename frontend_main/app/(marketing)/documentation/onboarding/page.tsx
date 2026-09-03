import React from "react";
import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All About Merchant Onboarding | ShopAgent Docs",
  description: "Complete end-to-end merchant onboarding guide. Learn how to map store authentication, product search catalog, delivery addresses, cart checkout, and webhook verification.",
};

export default async function OnboardingPage() {
  let onboarding = null;

  try {
    const { userId, getToken } = await auth();

    if (userId) {
      const token = await getToken();
      if (token) {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
        const response = await fetch(`${apiBaseUrl}/system/onboarding`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          next: { revalidate: 0 },
        });

        if (response.ok) {
          onboarding = await response.json();
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch onboarding details on server:", error);
  }

  return <OnboardingClient onboarding={onboarding} />;
}

