"use client";

import React from "react";
import { AlertCircle, Key, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APIKeyData } from "@/lib/api/keys";
import { ApiKeyRow, ApiKeyCard } from "./ApiKeyRow";

interface ApiKeysTableProps {
  keys: APIKeyData[];
  onPauseToggle: (id: string, name: string, active: boolean) => Promise<void>;
  onDeleteClick: (id: string, name: string) => void;
  toggleLoading: Record<string, boolean>;
  onGenerateClick: () => void;
}

export const ApiKeysTable: React.FC<ApiKeysTableProps> = ({
  keys,
  onPauseToggle,
  onDeleteClick,
  toggleLoading,
  onGenerateClick,
}) => {
  // Empty State Panel
  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 py-16 bg-surface border border-border border-dashed rounded-2xl space-y-5 shadow-xs font-sans max-w-2xl mx-auto">
        <div className="p-4 bg-primary-light text-primary rounded-full">
          <Key className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="font-heading text-lg font-bold text-text-primary">
            No API Keys Generated Yet
          </h3>
          <p className="text-sm text-text-secondary">
            Generate your first secret API key to start connecting and synchronizing your e-commerce platform catalog and checkout with the AI agent.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={onGenerateClick}
          className="flex items-center gap-1.5 font-semibold"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Generate your first key</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden sm:block bg-surface border border-border rounded-2xl overflow-visible shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="px-6 py-4.5 text-xs font-bold text-text-secondary uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-4.5 text-xs font-bold text-text-secondary uppercase tracking-wider">
                API Key (Token)
              </th>
              <th className="px-6 py-4.5 text-xs font-bold text-text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4.5 text-xs font-bold text-text-secondary uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-4.5 text-xs font-bold text-text-secondary uppercase tracking-wider">
                Last Used
              </th>
              <th className="px-6 py-4.5 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keys.map((key) => (
              <ApiKeyRow
                key={key.id}
                apiKey={key}
                onPauseToggle={onPauseToggle}
                onDeleteClick={onDeleteClick}
                toggleLoading={toggleLoading[key.id] || false}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card-per-key Layout */}
      <div className="block sm:hidden space-y-4">
        {keys.map((key) => (
          <ApiKeyCard
            key={key.id}
            apiKey={key}
            onPauseToggle={onPauseToggle}
            onDeleteClick={onDeleteClick}
            toggleLoading={toggleLoading[key.id] || false}
          />
        ))}
      </div>
    </div>
  );
};
