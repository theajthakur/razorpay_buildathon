import apiClient from "./client";

export type DomainStatus = "PENDING" | "ACTIVE" | "FAILED";

export interface DnsVerificationItem {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface RecommendedCnameItem {
  rank: number;
  value: string;
}

export interface RecommendedIpv4Item {
  rank: number;
  value: string[];
}

export interface DnsDetails {
  verified?: boolean;
  misconfigured?: boolean;
  recommendedCNAME?: RecommendedCnameItem[];
  recommendedIPv4?: RecommendedIpv4Item[];
  cname_target?: string;
  cnames?: string[];
  aValues?: string[];
  nameservers?: string[];
  configuredBy?: string | null;
  serviceType?: string;
  verification?: DnsVerificationItem[];
  apexName?: string;
  gitBranch?: string | null;
  [key: string]: any;
}

export interface DomainResponse {
  id: string;
  domain: string;
  status: DomainStatus;
  dns_details?: DnsDetails | null;
  created_at?: string;
  updated_at?: string;
}

export interface DomainListResponse {
  domains: DomainResponse[];
  total_count: number;
}

export interface DomainCreateRequest {
  domain: string;
}

/**
 * Submits a custom domain to be added to Vercel and ShopAgent system.
 */
export async function createDomain(domain: string): Promise<DomainResponse> {
  const response = await apiClient.post<DomainResponse>("/onboarding/domains", {
    domain,
  });
  return response.data;
}

/**
 * Fetches all domain mappings belonging to the authenticated merchant.
 */
export async function listDomains(): Promise<DomainListResponse> {
  const response = await apiClient.get<DomainListResponse>("/onboarding/domains");
  return response.data;
}

/**
 * Retrieves a specific domain mapping by ID.
 */
export async function getDomain(domainId: string): Promise<DomainResponse> {
  const response = await apiClient.get<DomainResponse>(`/onboarding/domains/${domainId}`);
  return response.data;
}

/**
 * Triggers DNS verification on Vercel and updates local status to ACTIVE or FAILED.
 */
export async function verifyDomain(domainId: string): Promise<DomainResponse> {
  const response = await apiClient.post<DomainResponse>(`/onboarding/domains/${domainId}/verify`);
  return response.data;
}

/**
 * Deletes a domain mapping from Vercel and the database.
 */
export async function deleteDomain(domainId: string): Promise<{ status: string; message: string }> {
  const response = await apiClient.delete<{ status: string; message: string }>(`/onboarding/domains/${domainId}`);
  return response.data;
}
