"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const ApiKeysHeader: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Back Link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Agent Settings</span>
      </Link>

      {/* Main Header Row */}
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-text-primary">
              Developer API Keys
            </h1>
          </div>
          <p className="text-sm text-text-secondary max-w-2xl">
            Integrate ShopAgent with custom e-commerce storefronts. Use these keys to authenticate secure checkout, cart negotiation, and profile requests.
          </p>
        </div>
      </div>
    </div>
  );
};
