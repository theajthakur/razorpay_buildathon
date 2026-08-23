import apiClient from "./client";

export interface EndpointDetails {
  path?: string;
  method?: string;
  payload_key?: string;
  response_key?: string;
  fetch_path?: string;
  fetch_method?: string;
  fetch_response_key?: string;
  create_path?: string;
  create_method?: string;
  create_fields?: string;
  cart_key?: string;
  item_id_field?: string;
  price_field?: string;
  quantity_field?: string;
  [key: string]: any;
}

export interface TokenDeliveryConfig {
  method: "header" | "cookie";
  header_name?: string | null;
  bearer_prefix?: boolean | null;
  cookie_name?: string | null;
}

export interface AuthConfig {
  auth_url: string;
  method: string;
  identifier_field: string;
  identifier_type: string;
  password_field: string;
  token_path: string;
  token_delivery: TokenDeliveryConfig;
}

export interface OnboardingData {
  base_url: string;
  auth_enabled: boolean;
  auth_disabled_ack: boolean;
  auth_config?: AuthConfig | null;
  endpoints?: Record<string, EndpointDetails> | null;
  products_config?: EndpointDetails | null;
  order_history_config?: EndpointDetails | null;
  customer_profile_config?: EndpointDetails | null;
  addresses_config?: EndpointDetails | null;
  create_order_config?: EndpointDetails | null;
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
  token_delivery_method?: string | null;
  token_delivery_name?: string | null;
  token_delivery_bearer?: boolean | null;
  payload?: Record<string, any> | null;
}

export interface TestEndpointResponse {
  status: "success" | "failed";
  status_code: number;
  preview: string;
  data: any;
}

export interface TestCustomerAuthPayload {
  auth_url: string;
  auth_method: string;
  payload: Record<string, any>;
}

export interface TestCustomerAuthResponse {
  status: "success" | "failed";
  status_code: number;
  data: any;
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
    // If onboarding data is not found (404) or request is unauthorized (401), return null to indicate clean state
    if (error.response && (error.response.status === 404 || error.response.status === 401)) {
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

/**
 * Proxy test customer login requests to merchant auth url to bypass CORS.
 */
export async function testCustomerAuth(data: TestCustomerAuthPayload): Promise<TestCustomerAuthResponse> {
  const response = await apiClient.post<TestCustomerAuthResponse>("/system/onboarding/test-customer-auth", data);
  return response.data;
}
