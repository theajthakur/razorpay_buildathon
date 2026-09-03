import apiClient from "./client";

export interface AdditionalField {
  key: string;
  value: string;
}

export interface AddressFetchConfig {
  path: string;
  method?: string;
  response_key?: string | null;
  id_field?: string;
  response_path?: string | null;
  display_field?: string | null;
}

export interface AddressCreateConfig {
  path: string;
  method?: string;
  field_mapping: string[];
}

export interface AddressesConfig {
  supports_creation: boolean;
  fetch: AddressFetchConfig;
  create?: AddressCreateConfig | null;
}

export interface CreateOrderConfig {
  path: string;
  method?: string;
  cart_key: string;
  item_id_field: string;
  price_field: string;
  quantity_field: string;
  address_id_field: string;
  additional_fields?: AdditionalField[];
}

export interface EndpointDetails {
  path?: string;
  method?: string;
  payload_key?: string;
  response_key?: string;
  array_path?: string;
  response_path?: string;
  response_object_path?: string;
  display_field?: string;
  field_mapping?: Record<string, string>;
  fields?: Record<string, string>;
  fetch_path?: string;
  fetch_method?: string;
  fetch_response_key?: string;
  create_path?: string;
  create_method?: string;
  create_fields?: string;
  supports_creation?: boolean;
  cart_key?: string;
  item_id_field?: string;
  price_field?: string;
  quantity_field?: string;
  address_id_field?: string;
  additional_fields?: string[] | AdditionalField[];
  [key: string]: any;
}

export interface TokenDeliveryConfig {
  method: "header" | "cookie";
  header_name?: string | null;
  bearer_prefix?: boolean | null;
  cookie_name?: string | null;
}

export interface AuthConfig {
  path?: string;
  auth_url?: string;
  method: string;
  identifier_field: string;
  identifier_type: string;
  password_field: string;
  token_path: string;
  token_delivery: TokenDeliveryConfig;
}

export interface VerifyOrderConfig {
  path: string;
  method: string;
  order_id_field: string;
  response_price_field: string;
}

export interface BrandingConfig {
  brand_color?: string | null;
  logo_url?: string | null;
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
  addresses_config?: AddressesConfig | EndpointDetails | null;
  create_order_config?: CreateOrderConfig | EndpointDetails | null;
  verify_order_config?: VerifyOrderConfig | null;
  bank_account?: string | null;
  ifsc?: string | null;
  branch_name?: string | null;
  branding_config?: BrandingConfig | null;
  webhook_url?: string | null;
  webhook_path?: string | null;
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
  base_url?: string;
  auth_path?: string;
  auth_url?: string;
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
 * Partially updates the onboarding configuration for autosave.
 */
export async function patchOnboardingDetails(data: Partial<OnboardingData>): Promise<OnboardingResponse> {
  const response = await apiClient.patch<OnboardingResponse>("/system/onboarding", data);
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
