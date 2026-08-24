"use client";

import React, { useState } from "react";
import { useApiKeys } from "./useApiKeys";
import { ApiKeysHeader } from "./components/ApiKeysHeader";
import { ApiKeysTable } from "./components/ApiKeysTable";
import { GenerateKeyDialog } from "./components/GenerateKeyDialog";
import { RevealKeyDialog } from "./components/RevealKeyDialog";
import { DeleteKeyDialog } from "./components/DeleteKeyDialog";

// Shimmer placeholder skeleton rows for initial loading state
const SkeletonLoader = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-surface border border-border rounded-2xl p-5.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse shadow-xs"
      >
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-border rounded-md w-1/3" />
          <div className="h-3 bg-border rounded-md w-2/3" />
        </div>
        <div className="h-9 bg-border rounded-lg w-20 shrink-0" />
      </div>
    ))}
  </div>
);

export default function ApiKeysPage() {
  const {
    keys,
    loading,
    error,
    totalCount,
    maxKeys,
    isLimitReached,
    takenNames,
    createKey,
    removeKey,
    togglePauseKey,
    toggleLoading,
  } = useApiKeys();

  // Modal Visibility States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState("");

  const handleGenerateSubmit = async (name: string) => {
    const result = await createKey(name);
    if (result && result.api_key) {
      setNewApiKey(result.api_key);
      setShowRevealModal(true);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargetId) {
      await removeKey(deleteTargetId, deleteTargetName);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* 1. Header */}
      <ApiKeysHeader />

      {/* 2. Key Generation Block / Limit Alert */}
      {totalCount >= 5 ? (
        <div className="bg-warning/10 border border-warning/20 text-warning rounded-2xl p-5 flex items-start gap-3 animate-in fade-in duration-200">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm">
            <p className="font-bold">Maximum API Key Limit Reached</p>
            <p className="text-text-secondary mt-0.5 font-medium">
              You have reached the maximum limit of 5 API keys. You must delete an existing key before you can generate a new one.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs flex justify-center sm:justify-start animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="bg-primary text-text-on-primary hover:bg-primary-hover shadow-xs inline-flex items-center justify-center font-semibold rounded-lg px-4 py-2.5 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer select-none w-full sm:w-auto"
          >
            Generate API Key
          </button>
        </div>
      )}

      {/* 3. Error banner, if any */}
      {error && (
        <div className="p-4 bg-error/10 border border-error/20 text-error rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {/* 4. Content Table / Skeletons */}
      {loading && keys.length === 0 ? (
        <SkeletonLoader />
      ) : (
        <ApiKeysTable
          keys={keys}
          onPauseToggle={togglePauseKey}
          onDeleteClick={handleDeleteClick}
          toggleLoading={toggleLoading}
          onGenerateClick={() => setShowGenerateModal(true)}
        />
      )}

      {/* 4. Action Dialogs */}
      <GenerateKeyDialog
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSubmit={handleGenerateSubmit}
        takenNames={takenNames}
      />

      <RevealKeyDialog
        isOpen={showRevealModal}
        apiKey={newApiKey}
        onClose={() => {
          setShowRevealModal(false);
          setNewApiKey(null);
        }}
      />

      <DeleteKeyDialog
        isOpen={showDeleteModal}
        keyName={deleteTargetName}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTargetId(null);
          setDeleteTargetName("");
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
