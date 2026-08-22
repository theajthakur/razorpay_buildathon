import apiClient from "./client";

export interface ClerkUserPayload {
  id: string;
  email_addresses: { email_address: string }[];
  first_name?: string | null;
  last_name?: string | null;
}

export interface UserAccountResponse {
  id: string;
  store_name: string | null;
  email: string;
  created_on: string;
  status: string;
}

/**
 * Direct sync trigger: Sends the authenticated Clerk user profile directly
 * to the backend's webhook receiver to ensure the DB row exists.
 */
export async function syncClerkUser(user: ClerkUserPayload): Promise<void> {
  const payload = {
    type: "user.created",
    data: {
      id: user.id,
      email_addresses: user.email_addresses.map((addr) => ({
        email_address: addr.email_address,
      })),
      first_name: user.first_name || "",
      last_name: user.last_name || "",
    },
  };

  await apiClient.post("/system/webhooks/clerk", payload);
}

/**
 * Saves the active Clerk User ID in localStorage to authorize future api requests.
 */
export function loginUser(clerkUserId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("clerk_user_id", clerkUserId);
  }
}

/**
 * Removes the active auth credentials from localStorage.
 */
export function logoutUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("clerk_user_id");
  }
}

/**
 * Queries the backend for the active merchant profile details.
 */
export async function fetchCurrentUser(): Promise<UserAccountResponse> {
  const response = await apiClient.get<UserAccountResponse>("/system/accounts/me");
  return response.data;
}
