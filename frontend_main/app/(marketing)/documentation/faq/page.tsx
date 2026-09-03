import React from "react";
import { Metadata } from "next";
import FaqClient from "./FaqClient";

export const metadata: Metadata = {
  title: "Common FAQs & Best Practices | ShopAgent Docs",
  description: "Frequently asked questions regarding ShopAgent merchant onboarding, API key management, payment webhooks, signature verification, key candidate mappings, and troubleshooting.",
};

export default function FaqPage() {
  return <FaqClient />;
}
