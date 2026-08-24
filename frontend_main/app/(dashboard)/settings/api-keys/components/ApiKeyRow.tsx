"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Pause, Play, Trash2, Calendar, Clock, Loader2 } from "lucide-react";
import { APIKeyData } from "@/lib/api/keys";

interface ApiKeyRowProps {
  apiKey: APIKeyData;
  onPauseToggle: (id: string, name: string, active: boolean) => Promise<void>;
  onDeleteClick: (id: string, name: string) => void;
  toggleLoading: boolean;
}

// Format creation date helper (shared)
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Format last used relative time helper (shared)
const formatLastUsed = (dateStr: string | null) => {
  if (!dateStr) return "Never used";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
};

// Component 1: Desktop Table Row Layout (Only tr)
export const ApiKeyRow: React.FC<ApiKeyRowProps> = ({
  apiKey,
  onPauseToggle,
  onDeleteClick,
  toggleLoading,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const isActive = apiKey.status === "active";

  return (
    <tr className={`hidden sm:table-row border-b border-border hover:bg-background/40 transition-colors font-sans group ${menuOpen ? "relative z-40" : ""}`}>
      <td className="px-6 py-4.5">
        <p className="font-semibold text-text-primary text-sm max-w-[200px] truncate" title={apiKey.name}>
          {apiKey.name}
        </p>
      </td>
      <td className="px-6 py-4.5 font-mono text-xs text-text-secondary">
        <span className="bg-background px-2.5 py-1 border border-border rounded-md select-all">
          sk_live_{apiKey.key_prefix}••••••••••••
        </span>
      </td>
      <td className="px-6 py-4.5">
        <span className={`text-xs font-semibold capitalize ${isActive ? "text-success" : "text-warning"}`}>
          {apiKey.status}
        </span>
      </td>
      <td className="px-6 py-4.5 text-xs text-text-secondary font-medium">
        {formatDate(apiKey.created_at)}
      </td>
      <td className="px-6 py-4.5 text-xs text-text-secondary font-medium">
        <span className={!apiKey.last_used_at ? "text-text-secondary/60 italic" : ""}>
          {formatLastUsed(apiKey.last_used_at)}
        </span>
      </td>
      <td className={`px-6 py-4.5 text-right ${menuOpen ? "relative z-40" : "relative"}`}>
        <div ref={menuRef} className="inline-block text-left">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
            aria-label="Actions"
          >
            {toggleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreVertical className="w-4 h-4" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-6 mt-1 w-44 rounded-xl bg-surface border border-border shadow-lg z-20 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Pause/Resume Action */}
              <button
                onClick={() => {
                  onPauseToggle(apiKey.id, apiKey.name, isActive);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-text-primary hover:bg-background transition-colors w-full text-left cursor-pointer"
              >
                {isActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-warning" />
                    <span>Pause API Key</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-success" />
                    <span>Resume API Key</span>
                  </>
                )}
              </button>

              {/* Delete Action */}
              <button
                onClick={() => {
                  onDeleteClick(apiKey.id, apiKey.name);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-error hover:bg-error/5 transition-colors border-t border-border w-full text-left cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete API Key</span>
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

// Component 2: Mobile Card Layout (Only div)
export const ApiKeyCard: React.FC<ApiKeyRowProps> = ({
  apiKey,
  onPauseToggle,
  onDeleteClick,
  toggleLoading,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const isActive = apiKey.status === "active";

  return (
    <div className={`sm:hidden bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xs transition-all ${menuOpen ? "relative z-40" : "relative"}`}>
      {/* Name and Action dropdown */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-bold text-text-primary text-sm truncate max-w-[180px]">
            {apiKey.name}
          </h4>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold capitalize ${isActive ? "text-success" : "text-warning"}`}>
              {apiKey.status}
            </span>
            <span className="text-[10px] text-text-secondary flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(apiKey.created_at)}
            </span>
          </div>
        </div>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
          >
            {toggleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreVertical className="w-4 h-4" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-surface border border-border shadow-lg z-20 overflow-hidden py-1">
              <button
                onClick={() => {
                  onPauseToggle(apiKey.id, apiKey.name, isActive);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-text-primary hover:bg-background transition-colors w-full text-left"
              >
                {isActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-warning" />
                    <span>Pause API Key</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-success" />
                    <span>Resume API Key</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  onDeleteClick(apiKey.id, apiKey.name);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-error hover:bg-error/5 transition-colors border-t border-border w-full text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete API Key</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prefix and Last Used Details */}
      <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-3.5">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-text-secondary uppercase">API Key Token</span>
          <div className="font-mono text-xs text-text-secondary break-all">
            sk_live_{apiKey.key_prefix}...
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Last Used</span>
          <div className="text-xs text-text-secondary font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-text-secondary/60" />
            <span className={!apiKey.last_used_at ? "text-text-secondary/60 italic" : ""}>
              {formatLastUsed(apiKey.last_used_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
