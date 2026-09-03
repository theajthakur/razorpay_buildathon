"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Rocket,
  Code2,
  ShieldCheck,
  HelpCircle,
  Search,
  BookOpen,
  ChevronRight,
  Menu,
  X,
  FileCode2
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  badge?: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        href: "/documentation",
        label: "Architecture & Overview",
        icon: Compass,
      },
      {
        href: "/documentation/onboarding",
        label: "1. All About Onboarding",
        icon: Rocket,
      },
    ],
  },
  {
    title: "Integration & Endpoints",
    items: [
      {
        href: "/documentation/endpoints",
        label: "2. Essential Endpoints",
        icon: Code2,
      },
      {
        href: "/documentation/verification",
        label: "3. Keys, Webhooks & Verify",
        icon: ShieldCheck,
      },
    ],
  },
  {
    title: "Help & References",
    items: [
      {
        href: "/documentation/faq",
        label: "Common FAQs & Mappings",
        icon: HelpCircle,
      },
    ],
  },
];

export default function DocumentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Filter sections based on search query
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  // Active item title for header breadcrumb
  const activeItem = navSections
    .flatMap((s) => s.items)
    .find((item) => item.href === pathname);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Top Banner / Breadcrumb sub-header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/documentation" className="hover:text-primary transition-colors">
              Docs
            </Link>
            {activeItem && activeItem.href !== "/documentation" && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-text-primary font-medium">{activeItem.label}</span>
              </>
            )}
          </div>

          {/* Mobile drawer toggle */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-background text-text-primary transition-colors"
          >
            <Menu className="w-4 h-4 text-primary" />
            <span>Navigation</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 flex flex-col lg:flex-row gap-10">

        {/* Left Sidebar: Sticky Navigation (Desktop) */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-3">
          <div className="space-y-6">

            {/* Search Filter Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Filter documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-text-primary placeholder:text-text-secondary/60 font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Navigation Group Sections */}
            <nav className="space-y-6 font-sans">
              {filteredSections.length > 0 ? (
                filteredSections.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <h4 className="text-xs font-bold text-text-secondary px-2">
                      {section.title}
                    </h4>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all ${isActive
                              ? "bg-primary text-text-on-primary shadow-xs"
                              : "text-text-secondary hover:text-text-primary hover:bg-surface"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-text-on-primary" : "text-primary"}`} />
                              <span className="truncate">{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-secondary px-2 py-4 italic">
                  No matching documentation sections found.
                </p>
              )}
            </nav>

            {/* AI Prompt Quick Copy Link */}
            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Need Developer Support?</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                All guides feature copyable raw Markdown for pasting into AI coding assistants like Cursor, Claude, or ChatGPT.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-text-primary/30 backdrop-blur-xs flex justify-start">
            <div className="w-80 max-w-[85vw] bg-surface h-full p-6 shadow-2xl flex flex-col border-r border-border animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <FileCode2 className="w-5 h-5 text-primary" />
                  <span>ShopAgent Docs</span>
                </div>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 rounded-lg hover:bg-background text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Filter documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-text-primary placeholder:text-text-secondary/60"
                />
              </div>

              <nav className="flex-1 overflow-y-auto space-y-6">
                {filteredSections.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <h4 className="text-xs font-bold text-text-secondary">
                      {section.title}
                    </h4>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileNavOpen(false)}
                            className={`flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl transition-all ${isActive
                              ? "bg-primary text-text-on-primary"
                              : "text-text-secondary hover:text-text-primary hover:bg-background"
                              }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className={`w-4 h-4 ${isActive ? "text-text-on-primary" : "text-primary"}`} />
                              <span>{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Documentation Body (Children) */}
        <main className="flex-1 flex flex-col lg:flex-row gap-10 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

