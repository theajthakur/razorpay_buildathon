"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, AlertCircle, Lock } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useBranding } from "@/lib/context/BrandingContext";
import apiClient from "@/lib/api/client";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const { branding, primaryColor } = useBranding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Focus email input on dialog open
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setPassword("");
      setError(null);
      setLogoError(false);
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateEmail = (val: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return;

    if (!validateEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    const merchantId = branding?.merchant_id;
    if (!merchantId) {
      setError("Unable to resolve merchant identity. Please reload the page.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.post<{ token: string; expires_at: string }>(
        "/api/public/auth/login",
        {
          merchant_id: merchantId,
          email: cleanEmail,
          password
        }
      );
      
      // Save authentication state
      login(response.data.token, cleanEmail, response.data.expires_at);
      onClose();
    } catch (err: any) {
      console.error("Login failure details:", err);
      
      if (err.status === 502 || err.message?.includes("mismatch")) {
        setError("Login is temporarily unavailable — please try again later.");
      } else if (err.status === 401 || err.status === 403) {
        setError("Invalid email or password.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = !email.trim() || !password || submitting;
  const displayName = branding?.display_name || "Ponion";

  return (
    <div className="fixed inset-0 bg-secondary-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-secondary-200 shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden flex flex-col font-sans animate-zoom-in">
        
        {/* Header with Merchant Logo & Name */}
        <div className="p-5 border-b border-secondary-100 flex items-center justify-between bg-secondary-50/50">
          <div className="flex items-center gap-3 min-w-0">
            {branding?.logo_url && !logoError ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-secondary-200 bg-white flex items-center justify-center p-1 shadow-xs">
                <img
                  src={branding.logo_url}
                  alt={displayName}
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-secondary-100"
              >
                <Lock className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-secondary-900 text-base truncate">
                Sign In to {displayName}
              </h3>
              <p className="text-[10px] text-secondary-400 font-medium mt-0.5">
                Access your order history and chat sessions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 transition-colors cursor-pointer shrink-0"
            disabled={submitting}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Email field */}
            <div>
              <label htmlFor="email" className="text-xs font-bold text-secondary-700 block mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                ref={emailInputRef}
                placeholder="e.g. alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-secondary-300/30 text-sm placeholder-secondary-400"
                required
              />
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="text-xs font-bold text-secondary-700 block mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-secondary-300/30 text-sm placeholder-secondary-400"
                required
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-secondary-100 flex items-center justify-end gap-2.5 bg-secondary-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-secondary-600 hover:bg-secondary-100 font-semibold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              style={!isSubmitDisabled ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
              className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 cursor-pointer ${
                isSubmitDisabled
                  ? "bg-secondary-100 text-secondary-400 cursor-not-allowed"
                  : "hover:brightness-95 text-white"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default LoginModal;
