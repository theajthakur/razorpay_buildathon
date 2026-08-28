import apiClient from "./client";

export interface BrandingConfig {
  brand_color?: string | null;
  logo_url?: string | null;
  display_name?: string | null;
}

/**
 * Fetches the public branding config for the merchant.
 * The backend resolves the merchant by Host header.
 * If called on the client side, it defaults to using `window.location.host`.
 * If called on the server side (Server Components / API Routes), a custom host must be passed.
 */
export async function fetchPublicBranding(host?: string): Promise<BrandingConfig> {
  const headers: Record<string, string> = {};

  if (host) {
    headers["Host"] = host;
  } else if (typeof window !== "undefined") {
    // Falls back to window.location.host when running in the browser
    headers["Host"] = window.location.host;
  }

  const response = await apiClient.get<BrandingConfig>("/api/public/branding", {
    headers,
  });
  
  return response.data;
}
