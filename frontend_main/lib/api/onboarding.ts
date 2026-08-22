import apiClient from "./client";

export interface EndpointDetails {
  path: string;
  method: string;
}

export interface OnboardingData {
  base_url: string;
  auth_needed: boolean;
  auth_method?: string | null;
  credential_value?: string | null;
  endpoints: Record<string, EndpointDetails>;
  bank_account?: string | null;
  ifsc?: string | null;
  branch_name?: string | null;
}

export interface OnboardingResponse extends OnboardingData {
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TestEndpointPayload {
  base_url: string;
  auth_needed: boolean;
  auth_method?: string | null;
  credential_value?: string | null;
  path: string;
  method: string;
}

export interface TestEndpointResponse {
  status: "success" | "failed";
  status_code: number;
  preview: string;
}

/**
 * Fetches the existing onboarding configuration from the backend database.
 * Returns null if the user has not completed onboarding yet (receives a 404).
 */
export async function fetchOnboardingDetails(): Promise<OnboardingResponse | null> {
  try {
    const response = await apiClient.get<OnboardingResponse>("/system/onboarding");
    return response.data;
  } catch (error: any) {
    // If onboarding data is not found (404), return null indicating a clean signup
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Saves or updates the onboarding configuration details to the backend database.
 */
export async function saveOnboardingDetails(data: OnboardingData): Promise<OnboardingResponse> {
  const response = await apiClient.post<OnboardingResponse>("/system/onboarding", data);
  return response.data;
}

/**
 * Proxy requests to merchant business endpoints for CORS-free integration verification.
 */
export async function testEndpoint(data: TestEndpointPayload): Promise<TestEndpointResponse> {
  const response = await apiClient.post<TestEndpointResponse>("/system/onboarding/test-endpoint", data);
  return response.data;
}
