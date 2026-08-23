"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DocumentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-10 flex-1 flex flex-col lg:flex-row gap-12 relative">
      {/* Left Sidebar: Global Docs Navigation */}
      <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-24 self-start border-b lg:border-b-0 lg:border-r border-border pb-6 lg:pb-0 lg:pr-6">
        <div className="space-y-5">
          <h3 className="font-heading font-bold text-xs text-text-primary uppercase tracking-wider px-2">
            Guides
          </h3>
          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            <Link
              href="/documentation/onboarding"
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
                pathname === "/documentation/onboarding"
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-text-secondary hover:text-text-primary hover:bg-background"
              }`}
            >
              Onboarding Guide
            </Link>
            <Link
              href="/documentation"
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
                pathname === "/documentation"
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-text-secondary hover:text-text-primary hover:bg-background"
              }`}
            >
              API Reference
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content & Page TOC (passed as children) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-12 min-w-0">
        {children}
      </div>
    </div>
  );
}
