"use client";

import React, { useState } from "react";
import { X, Globe, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDomain, DomainResponse } from "@/lib/api/domain";

interface DomainAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (domain: DomainResponse) => void;
}

export const DomainAddModal: React.FC<DomainAddModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg("Domain name cannot be empty.");
      return;
    }

    // Basic format validation
    const cleaned = trimmed.replace(/^https?:\/\//, "").split("/")[0];
    if (!cleaned.includes(".")) {
      setErrorMsg("Please enter a valid hostname with a domain extension (e.g. agent.merchant.com).");
      return;
    }

    setLoading(true);

    try {
      const result = await createDomain(cleaned);
      setDomainInput("");
      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error("Failed to add domain:", err);
      const backendError = err.response?.data?.detail || err.message || "Failed to add domain to system.";
      setErrorMsg(backendError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-primary/40 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-surface border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-5 sm:space-y-6 font-sans relative my-auto max-h-[90vh] flex flex-col overflow-y-auto min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-base sm:text-lg font-bold text-text-primary truncate">
                Add Custom Domain
              </h3>
              <p className="text-xs text-text-secondary truncate">
                Connect your storefront subdomain to ShopAgent
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error alert callout */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-error/10 border border-error/20 flex items-start gap-2.5 text-xs text-error font-medium min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 break-words">{errorMsg}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0 flex-1">
          <div className="space-y-2 min-w-0">
            <label className="text-xs font-semibold text-text-primary block font-heading">
              Domain Hostname
            </label>
            <div className="relative min-w-0">
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="e.g. agent.yourstore.com"
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono min-w-0"
              />
            </div>
            <p className="text-[11px] text-text-secondary leading-normal">
              Subdomains like <code className="font-mono bg-background px-1 py-0.5 rounded border border-border break-all">agent.store.com</code> or custom domains are supported.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              className="text-xs w-full sm:w-auto"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={loading || !domainInput.trim()}
              className="gap-2 text-xs w-full sm:w-auto justify-center whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Configuring Domain...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Connect Custom Domain</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
