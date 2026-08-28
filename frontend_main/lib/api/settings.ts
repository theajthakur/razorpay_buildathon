import axios from "axios";
import apiClient from "./client";

export interface MerchantSettings {
  logo_url?: string | null;
  brand_color?: string | null;
  accent_color?: string | null;
  display_name?: string | null;
  confirmation_limit?: number | null;
  toggles?: Record<string, boolean> | null;
}

export interface LogoPresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * Fetches the merchant settings from the backend.
 */
export async function fetchMerchantSettings(): Promise<MerchantSettings> {
  const response = await apiClient.get<MerchantSettings>("/api/dashboard/settings");
  return response.data;
}

/**
 * Saves/updates the merchant settings.
 */
export async function updateMerchantSettings(data: MerchantSettings): Promise<MerchantSettings> {
  const response = await apiClient.patch<MerchantSettings>("/api/dashboard/settings", data);
  return response.data;
}

/**
 * Requests a presigned URL from the backend for direct S3 logo upload.
 */
export async function getPresignedLogoUrl(fileName: string, fileType: string): Promise<LogoPresignResponse> {
  const response = await apiClient.post<LogoPresignResponse>("/api/dashboard/settings/logo/presign", {
    fileName,
    fileType,
  });
  return response.data;
}

/**
 * Uploads a raw file directly to S3 using the presigned PUT URL.
 * Bypasses the default apiClient to avoid appending Authorization headers.
 */
export async function uploadFileToS3(uploadUrl: string, file: File, fileType: string): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: {
      "Content-Type": fileType,
    },
  });
}
