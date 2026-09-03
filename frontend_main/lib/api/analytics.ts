import apiClient from "./client";

export interface AnalyticsSummary {
  revenue: {
    total: string;
    relative_yesterday: string;
  };
  orders: {
    total_count: string;
    average_cart_value: string;
  };
  conversations: {
    total: string;
    average_per_user: string;
  };
}

export interface ActivityItem {
  id: string;
  type: "order" | "chat" | "sync" | "system";
  title: string;
  subtitle: string;
  amount: string | null;
  timestamp: string;
}

export interface RecentActivityResponse {
  activities: ActivityItem[];
}

/**
 * Fetches analytics summary metrics independently.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await apiClient.get<AnalyticsSummary>("/system/analytics/summary");
  return response.data;
}

/**
 * Fetches recent activity feed independently.
 */
export async function getRecentActivity(): Promise<RecentActivityResponse> {
  const response = await apiClient.get<RecentActivityResponse>("/system/analytics/activity");
  return response.data;
}
