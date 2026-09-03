import React from "react";
import { Metadata } from "next";
import VerificationClient from "./VerificationClient";

export const metadata: Metadata = {
  title: "API Keys, Webhooks & S2S Payment Verification | ShopAgent Docs",
  description: "Comprehensive guide to API Keys (sk_live_...), order.payment_completed webhooks, idempotency handling, signature verification, and Server-to-Server order status verification.",
};

export default function VerificationPage() {
  return <VerificationClient />;
}
