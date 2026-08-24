"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";

interface GenerateKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<any>;
  takenNames: Set<string>;
}

export const GenerateKeyDialog: React.FC<GenerateKeyDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  takenNames,
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the input on dialog open
  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Live duplicate validation as the user types (case-insensitive)
  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed && takenNames.has(trimmed.toLowerCase())) {
      setError("You already have an API key with this name.");
    } else {
      setError(null);
    }
  }, [name, takenNames]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (takenNames.has(trimmed.toLowerCase())) {
      setError("You already have an API key with this name.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: any) {
      const errData = err.response?.data?.error;
      setError(errData?.message || "Failed to generate key. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = !name.trim() || !!error || submitting;

  return (
    <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface max-w-md w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-background-alt">
          <div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Generate API Key
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Choose a descriptive name for your new API key.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
            disabled={submitting}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <Input
              ref={inputRef}
              label="API Key Name"
              placeholder="e.g. Production Checkout"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={error || undefined}
              maxLength={100}
              required
              disabled={submitting}
            />
            <p className="text-xs text-text-secondary">
              Use a name that helps you identify where this key is used (e.g. "Dev Storefront" or "Mobile App").
            </p>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border flex items-center justify-end gap-3 bg-background-alt">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitDisabled}
              className="flex items-center gap-2 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <span>Generate Key</span>
              )}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
