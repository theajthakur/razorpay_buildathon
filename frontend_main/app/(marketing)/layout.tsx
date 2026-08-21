"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col text-text-primary">
      {/* Sticky Scroll-linked Navbar */}
      <header
        className={`h-16 border-b border-border flex items-center justify-between px-6 md:px-12 sticky top-0 z-50 transition-all duration-200 ${
          isScrolled ? "bg-surface shadow-md" : "bg-background"
        }`}
      >
        {/* Wordmark logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-lg">
            M
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-text-primary">
            Merchant OS
          </span>
        </Link>

        {/* Desktop Navbar Actions (Hidden on mobile) */}
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-6">
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              How it works
            </Link>
            <Link
              href="#features"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Features
            </Link>
          </nav>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm" className="shadow-xs">
                Get Started
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Hamburger Button (Visible only on mobile) */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors focus:outline-none cursor-pointer"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Dropdown Menu */}
      {isOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 bg-surface border-b border-border shadow-lg flex flex-col p-6 space-y-4 z-40 transition-all duration-200">
          <nav className="flex flex-col space-y-3">
            <Link
              href="#how-it-works"
              onClick={() => setIsOpen(false)}
              className="text-base font-semibold text-text-secondary hover:text-text-primary py-1.5 transition-colors"
            >
              How it works
            </Link>
            <Link
              href="#features"
              onClick={() => setIsOpen(false)}
              className="text-base font-semibold text-text-secondary hover:text-text-primary py-1.5 transition-colors"
            >
              Features
            </Link>
          </nav>

          <div className="h-px bg-border w-full" />

          <div className="flex flex-col space-y-2.5">
            <Link href="/login" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" size="md" className="w-full justify-center">
                Sign In
              </Button>
            </Link>
            <Link href="/signup" onClick={() => setIsOpen(false)}>
              <Button variant="primary" size="md" className="w-full justify-center shadow-xs">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Page Canvas */}
      <div className="flex-1 flex flex-col">{children}</div>

      {/* Footer */}
      <footer className="relative z-20 bg-secondary py-12 text-center text-xs text-text-on-primary">
        <p>&copy; {new Date().getFullYear()} Merchant OS. All rights reserved.</p>
      </footer>
    </div>
  );
}
