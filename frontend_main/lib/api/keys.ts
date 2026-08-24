import apiClient from "./client";

export interface APIKeyData {
  id: string;
  name: string;
  key_prefix: string;
  status: "active" | "paused";
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

export interface APIKeyListResponse {
  keys: APIKeyData[];
  active_count: number;
  total_count: number;
  max_keys: number;
}

export interface APIKeyCreateResponse {
  id: string;
  name: string;
  key_prefix: string;
  api_key: string;
  status: "active" | "paused";
  created_at: string;
  expires_at: string | null;
}

/**
 * Fetches all API keys for the current merchant.
 */
export async function fetchApiKeys(): Promise<APIKeyListResponse> {
  const response = await apiClient.get<APIKeyListResponse>("/api/dashboard/keys");
  return response.data;
}

/**
 * Generates a new API key for the current merchant.
 */
export async function createApiKey(name: string): Promise<APIKeyCreateResponse> {
  const response = await apiClient.post<APIKeyCreateResponse>("/api/dashboard/keys", { name });
  return response.data;
}

/**
 * Immediately deletes the specified API key from the database.
 */
export async function deleteApiKey(keyId: string): Promise<{ status: string; message: string }> {
  const response = await apiClient.delete<{ status: string; message: string }>(`/api/dashboard/keys/${keyId}`);
  return response.data;
}

/**
 * Pauses the specified API key.
 */
export async function pauseApiKey(keyId: string): Promise<APIKeyData> {
  const response = await apiClient.patch<APIKeyData>(`/api/dashboard/keys/${keyId}/pause`);
  return response.data;
}

/**
 * Resumes/continues the specified API key.
 */
export async function continueApiKey(keyId: string): Promise<APIKeyData> {
  const response = await apiClient.patch<APIKeyData>(`/api/dashboard/keys/${keyId}/continue`);
  return response.data;
}
