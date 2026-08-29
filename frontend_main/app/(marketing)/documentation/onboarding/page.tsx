import React from "react";
import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export const metadata: Metadata = {
  title: "Merchant Onboarding Guide | ShopAgent",
  description: "Step-by-step merchant setup guide. Learn how to connect your catalog, integrate authentication, test in sandbox mode, and deploy the AI shopping agent widget to your e-commerce storefront.",
};

export default async function OnboardingPage() {
  const { userId, getToken } = await auth();

  // Redirect to login if user is not authenticated
  if (!userId) {
    redirect("/login?redirect_url=/documentation/onboarding");
  }

  const token = await getToken();
  let onboarding = null;

  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const response = await fetch(`${apiBaseUrl}/system/onboarding`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 0 }, // Ensure dynamic fetching on every request
    });

    if (response.ok) {
      onboarding = await response.json();
    }
  } catch (error) {
    console.error("Failed to fetch onboarding details on server:", error);
  }

  return <OnboardingClient onboarding={onboarding} />;
}
