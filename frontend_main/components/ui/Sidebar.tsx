"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Compass, Settings, LogOut, X } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { logoutUser } from "@/lib/api/auth";

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose = () => { } }) => {
  const pathname = usePathname();
  const { signOut } = useClerk();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Onboarding", href: "/onboarding", icon: Compass },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    logoutUser();
    await signOut();
    window.location.href = "/";
  };

  return (
    <>
      {/* Mobile Sidebar Backdrop Panel Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="md:hidden fixed inset-0 z-40 bg-text-primary/20 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`bg-surface border-r border-border flex flex-col h-screen fixed md:sticky top-0 left-0 z-50 md:z-10 transition-transform duration-300 md:translate-x-0 w-64 shrink-0 ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
          }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <img src="/assets/logo.png" alt="ShopAgent Logo" className="w-8 h-8 object-contain" />
            <span className="font-heading font-bold text-lg text-text-primary">
              ShopAgent
            </span>
          </Link>
          {/* Close button for mobile screens */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                    ? "bg-primary-light text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-background"
                  }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer / Sign Out action */}
        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-error hover:bg-background transition-colors w-full text-left cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
