import React from "react";
import { User, Bell, ChevronDown } from "lucide-react";

export interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = "Dashboard" }) => {
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
          <div className="w-9 h-9 rounded-full bg-primary-light text-primary flex items-center justify-center font-heading font-semibold text-sm">
            AS
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-text-primary leading-none">
              Acme Store
            </p>
            <p className="text-xs text-text-secondary mt-1">
              merchant@acme.com
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        </div>
      </div>
    </header>
  );
};
