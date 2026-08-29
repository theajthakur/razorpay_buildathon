import React from "react";
import { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard Reference Guides | ShopAgent",
  description: "Detailed merchant documentation explaining how to manage AI shopping assistant settings, configure capabilities, and manage secure developer API keys.",
};

export default function DashboardDocsPage() {
  return <DashboardClient />;
}
