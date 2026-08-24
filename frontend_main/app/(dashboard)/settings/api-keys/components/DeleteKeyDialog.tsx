"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  keyName: string;
}

export const DeleteKeyDialog: React.FC<DeleteKeyDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  keyName,
}) => {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Failed to delete key: ", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface max-w-md w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-5 border-b border-border bg-background-alt flex items-start gap-3">
          <div className="p-2 bg-error/10 text-error rounded-lg shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Delete API Key
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Confirm permanent deletion of this API key.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          <p className="text-sm text-text-primary font-medium">
            Are you sure you want to delete <span className="font-bold">"{keyName}"</span>?
          </p>
          <div className="text-xs text-text-secondary space-y-1.5 leading-relaxed">
            <p>
              • Requests currently using this key will immediately fail with a <code className="px-1 py-0.5 bg-background border rounded font-mono text-[10px] whitespace-nowrap">401 Unauthorized</code> response.
            </p>
            <p>
              • This action is <span className="text-error font-semibold">permanent</span> and cannot be undone.
            </p>
            <p>
              • Deleting this key will free up a slot (maximum 5 keys total).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex items-center justify-end gap-3 bg-background-alt">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-error hover:opacity-90 text-white font-semibold flex items-center gap-2 border border-transparent shadow-xs"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Key</span>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
};
