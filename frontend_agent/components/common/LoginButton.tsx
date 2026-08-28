"use client";

import React, { useState } from "react";
import { LogIn, LogOut, User } from "lucide-react";

export function LoginButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <button
      onClick={() => setIsLoggedIn(!isLoggedIn)}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-secondary-200 bg-background-100 hover:bg-background-200 text-secondary-850 transition-all duration-200 select-none group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      title={isLoggedIn ? "Click to Sign Out" : "Click to Sign In"}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 transition-colors">
          {isLoggedIn ? (
            <div className="relative">
              <User className="w-4 h-4" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-background-100" />
            </div>
          ) : (
            <User className="w-4 h-4 opacity-60" />
          )}
        </div>
        <div className="flex flex-col items-start text-left min-w-0">
          <span className="text-xs font-semibold text-secondary-900 truncate w-full">
            {isLoggedIn ? "Ponion Merchant" : "Guest User"}
          </span>
          <span className="text-[10px] text-secondary-500 truncate w-full">
            {isLoggedIn ? "store-manager@ponion.io" : "Sign in to save chats"}
          </span>
        </div>
      </div>
      <div className="shrink-0 pl-1">
        {isLoggedIn ? (
          <LogOut className="w-4 h-4 text-secondary-400 group-hover:text-primary-500 transition-colors" />
        ) : (
          <LogIn className="w-4 h-4 text-secondary-400 group-hover:text-primary-500 transition-colors" />
        )}
      </div>
    </button>
  );
}
