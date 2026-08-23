"use client";

import React from "react";
import { Bell } from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";

export interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = "Dashboard" }) => {
  const { user } = useUser();

  React.useEffect(() => {
    if (user && typeof window !== "undefined") {
      const storedToken = localStorage.getItem("clerk_user_id");
      if (!storedToken || storedToken !== user.id) {
        localStorage.setItem("clerk_user_id", user.id);
      }
    }
  }, [user]);

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
      {/* Title */}
      <div>
        <h1 className="font-heading text-lg font-bold text-text-primary">
          {title}
        </h1>
      </div>

      {/* Right User Profile Area */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-3">
          <UserButton />
          
          {user && (
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-text-primary leading-none">
                {user.fullName || "Merchant"}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
