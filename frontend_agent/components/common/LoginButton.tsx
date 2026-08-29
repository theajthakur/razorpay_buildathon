"use client";

import React, { useState } from "react";
import { LogIn, LogOut, User, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useBranding } from "@/lib/context/BrandingContext";

interface LoginButtonProps {
  onOpenLogin: () => void;
}

export function LoginButton({ onOpenLogin }: LoginButtonProps) {
  const { isAuthenticated, email, logout } = useAuth();
  const { branding } = useBranding();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleClick = async () => {
    if (isAuthenticated) {
      setLoggingOut(true);
      try {
        await logout();
      } catch (err) {
        console.error("Logout failed:", err);
      } finally {
        setLoggingOut(false);
      }
    } else {
      onOpenLogin();
    }
  };

  const displayName = branding?.display_name || "Merchant";

  return (
    <button
      onClick={handleClick}
      disabled={loggingOut}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-secondary-200 bg-background-100 hover:bg-background-200 text-secondary-850 transition-all duration-200 select-none group cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-300/20 disabled:opacity-60 disabled:pointer-events-none"
      title={isAuthenticated ? "Click to Sign Out" : "Click to Sign In"}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 transition-colors">
          {isAuthenticated ? (
            <div className="relative">
              <User className="w-4.5 h-4.5" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-background-100" />
            </div>
          ) : (
            <User className="w-4.5 h-4.5 opacity-60" />
          )}
        </div>
        <div className="flex flex-col items-start text-left min-w-0">
          <span className="text-xs font-semibold text-secondary-900 truncate w-full">
            {isAuthenticated ? displayName + " Customer" : "Guest User"}
          </span>
          <span className="text-[10px] text-secondary-500 truncate w-full">
            {isAuthenticated ? email : "Sign in to save chats"}
          </span>
        </div>
      </div>
      <div className="shrink-0 pl-1">
        {loggingOut ? (
          <Loader2 className="w-4 h-4 animate-spin text-secondary-400" />
        ) : isAuthenticated ? (
          <LogOut className="w-4 h-4 text-secondary-400 group-hover:text-primary-500 transition-colors" />
        ) : (
          <LogIn className="w-4 h-4 text-secondary-400 group-hover:text-primary-500 transition-colors" />
        )}
      </div>
    </button>
  );
}

export default LoginButton;
