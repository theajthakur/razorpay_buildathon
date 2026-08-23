import React from "react";
import fs from "fs";
import path from "path";
import { Metadata } from "next";
import DocumentationClient from "./DocumentationClient";

export const metadata: Metadata = {
  title: "Merchant Integration Documentation | ShopAgent",
  description: "Securely integrate your e-commerce store with ShopAgent AI shopping agents. Full API references, order lifecycle status guides, webhook schemas, and verification flows.",
};

export default function DocumentationPage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "docs/integration.md");
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error("Failed to read docs/integration.md:", error);
    content = "# Error\nFailed to load the documentation content. Please try again later.";
  }

  return <DocumentationClient rawMarkdown={content} />;
}
