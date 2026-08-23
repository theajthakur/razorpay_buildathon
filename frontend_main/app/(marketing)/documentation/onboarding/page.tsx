import React from "react";
import { Metadata } from "next";
import OnboardingClient from "./OnboardingClient";

export const metadata: Metadata = {
  title: "Merchant Onboarding Guide | ShopAgent",
  description: "Step-by-step merchant setup guide. Learn how to connect your catalog, integrate authentication, test in sandbox mode, and deploy the AI shopping agent widget to your e-commerce storefront.",
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
