import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import {
  fetchApiKeys,
  createApiKey,
  deleteApiKey,
  pauseApiKey,
  continueApiKey,
  APIKeyData,
  APIKeyCreateResponse,
} from "@/lib/api/keys";
import { toast } from "sonner";

export function useApiKeys() {
  const { isLoaded: authLoaded, isSignedIn: authSignedIn } = useAuth();
  const [keys, setKeys] = useState<APIKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [maxKeys, setMaxKeys] = useState(5);

  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});

  const loadKeys = useCallback(async (showSilentError = false) => {
    try {
      setLoading(true);
      const data = await fetchApiKeys();
      setKeys(data.keys);
      setTotalCount(data.total_count);
      setActiveCount(data.active_count);
      setMaxKeys(data.max_keys);
      setError(null);
    } catch (err: any) {
      if (axios.isCancel(err)) {
        return;
      }
      console.error("Failed to load API keys:", err);
      const errMsg = err.response?.data?.detail || "Failed to load API keys.";
      setError(errMsg);
      if (!showSilentError) {
        toast.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const createKey = useCallback(async (name: string): Promise<APIKeyCreateResponse | null> => {
    setCreateLoading(true);
    try {
      const newKey = await createApiKey(name);
      toast.success(`API Key "${name}" generated successfully.`);
      await loadKeys(true);
      return newKey;
    } catch (err: any) {
      console.error("Failed to create API key:", err);
      const errData = err.response?.data?.error;
      const errMsg = errData?.message || err.response?.data?.detail || "Failed to create API key.";
      toast.error(errMsg);
      throw err;
    } finally {
      setCreateLoading(false);
    }
  }, [loadKeys]);

  const removeKey = useCallback(async (id: string, name: string) => {
    setDeleteLoading(true);
    try {
      await deleteApiKey(id);
      toast.success(`API Key "${name}" deleted successfully.`);
      await loadKeys(true);
    } catch (err: any) {
      console.error("Failed to delete API key:", err);
      const errMsg = err.response?.data?.detail || "Failed to delete API key.";
      toast.error(errMsg);
    } finally {
      setDeleteLoading(false);
    }
  }, [loadKeys]);

  const togglePauseKey = useCallback(async (id: string, name: string, currentlyActive: boolean) => {
    setToggleLoading(prev => ({ ...prev, [id]: true }));
    try {
      if (currentlyActive) {
        await pauseApiKey(id);
        toast.info(`API Key "${name}" paused.`);
      } else {
        await continueApiKey(id);
        toast.success(`API Key "${name}" resumed.`);
      }
      await loadKeys(true);
    } catch (err: any) {
      console.error("Failed to toggle API key status:", err);
      const errMsg = err.response?.data?.detail || "Failed to change API key status.";
      toast.error(errMsg);
    } finally {
      setToggleLoading(prev => ({ ...prev, [id]: false }));
    }
  }, [loadKeys]);

  // Derived state: Case-insensitive set of taken names
  const takenNames = useMemo(() => {
    return new Set(keys.map(k => k.name.trim().toLowerCase()));
  }, [keys]);

  // Derived state: Check if max key limit is reached
  const isLimitReached = useMemo(() => {
    return totalCount >= maxKeys;
  }, [totalCount, maxKeys]);

  useEffect(() => {
    if (authLoaded) {
      if (authSignedIn) {
        loadKeys();
      } else {
        setLoading(false);
      }
    }
  }, [authLoaded, authSignedIn, loadKeys]);

  return {
    keys,
    loading,
    error,
    totalCount,
    activeCount,
    maxKeys,
    isLimitReached,
    takenNames,
    createLoading,
    deleteLoading,
    toggleLoading,
    createKey,
    removeKey,
    togglePauseKey,
    refetchKeys: loadKeys,
  };
}
