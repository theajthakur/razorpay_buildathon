"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteDomain } from "@/lib/api/domain";

interface DomainDeleteModalProps {
  isOpen: boolean;
  domainId: string | null;
  domainName: string | null;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export const DomainDeleteModal: React.FC<DomainDeleteModalProps> = ({
  isOpen,
  domainId,
  domainName,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !domainId || !domainName) return null;

  const handleDelete = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      await deleteDomain(domainId);
      onSuccess(domainId);
      onClose();
    } catch (err: any) {
      console.error("Failed to delete domain:", err);
      const msg = err.response?.data?.detail || err.message || "Failed to remove domain.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-primary/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 font-sans relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-error/10 text-error">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-text-primary">
                Delete Custom Domain
              </h3>
              <p className="text-xs text-text-secondary">
                Remove domain routing from Vercel & ShopAgent
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Body */}
        <div className="space-y-3 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <p>
            Are you sure you want to remove <strong className="font-mono text-text-primary">{domainName}</strong>?
          </p>
          <div className="p-3 rounded-xl bg-background border border-border text-xs text-text-secondary">
            This action will disconnect the custom domain from Vercel. Any storefront or widget embedding using this domain will stop responding.
          </div>
        </div>

        {/* Error alert callout */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-error/10 border border-error/20 text-xs text-error font-medium">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={loading}
            className="gap-2 text-xs bg-error text-white hover:bg-error/90 border-transparent"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting Domain...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete Domain</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
