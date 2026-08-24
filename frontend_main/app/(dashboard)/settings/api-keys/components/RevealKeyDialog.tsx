"use client";

import React, { useState, useEffect } from "react";
import { Info, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RevealKeyDialogProps {
  isOpen: boolean;
  apiKey: string | null;
  onClose: () => void;
}

export const RevealKeyDialog: React.FC<RevealKeyDialogProps> = ({
  isOpen,
  apiKey,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [hasCopiedOnce, setHasCopiedOnce] = useState(false);
  const [showKey, setShowKey] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setHasCopiedOnce(false);
      setShowKey(true);
    }
  }, [isOpen]);

  if (!isOpen || !apiKey) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setHasCopiedOnce(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface max-w-lg w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-5 border-b border-border bg-background-alt">
          <h3 className="font-heading text-lg font-bold text-text-primary">
            Save Your API Key
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Below is your new API key. Copy and store it immediately.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Key Block */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3.5 bg-background border border-border rounded-xl font-mono text-sm text-text-primary overflow-hidden relative">
              <span className={`flex-1 select-all break-all pr-12 ${!showKey ? "blur-[5px]" : ""}`}>
                {apiKey}
              </span>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-background pl-2 pr-1">
                {/* Toggle Show/Hide Key */}
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${copied
                    ? "bg-success/10 border-success/20 text-success"
                    : "bg-surface border-border text-text-secondary hover:text-text-primary hover:border-text-secondary"
                    }`}
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex items-center justify-between bg-background-alt">
          <p className="text-xs text-text-secondary max-w-[65%]">
            {!hasCopiedOnce ? (
              <span className="text-text-secondary font-medium">Please copy your API key to continue.</span>
            ) : (
              <span className="text-success font-medium">Key copied. Ready to close.</span>
            )}
          </p>
          <Button
            type="button"
            variant={hasCopiedOnce ? "primary" : "secondary"}
            disabled={!hasCopiedOnce}
            onClick={onClose}
            className="font-semibold px-5"
          >
            I've Saved the Key
          </Button>
        </div>

      </div>
    </div>
  );
};
