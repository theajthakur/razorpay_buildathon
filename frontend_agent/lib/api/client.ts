import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from "axios";

export interface ApiError {
  message: string;
  status: number | null;
  isNetworkError: boolean;
  raw?: any;
}

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000; // 10 seconds

// Create configured axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",
  timeout: TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper to check if a response error is already normalized
export function isApiError(error: any): error is ApiError {
  return (
    error !== null &&
    typeof error === "object" &&
    typeof error.message === "string" &&
    (error.status === null || typeof error.status === "number") &&
    typeof error.isNetworkError === "boolean"
  );
}

// Normalizes axios errors into a consistent structure for UI rendering
function normalizeError(error: any): ApiError {
  if (isApiError(error)) {
    return error;
  }

  const isNetworkError = !error.response;
  let message = "An unexpected error occurred. Please try again.";
  let status: number | null = null;

  if (error.response) {
    status = error.response.status;
    const detail = error.response.data?.detail;
    if (typeof detail === "string") {
      message = detail;
    } else if (error.response.data?.message) {
      message = error.response.data.message;
    } else {
      message = error.message || message;
    }
  } else if (error.code === "ECONNABORTED") {
    message = "Request timed out. The server took too long to respond.";
  } else if (error.request) {
    message = "Network connection failed. Please check your internet connection.";
  } else {
    message = error.message || message;
  }

  return {
    message,
    status,
    isNetworkError,
    raw: error,
  };
}

// Response interceptor to manage automatic retries and error normalization
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const config = error.config as CustomRequestConfig;

    // If config doesn't exist or retry is disabled, immediately reject with normalized error
    if (!config) {
      return Promise.reject(normalizeError(error));
    }

    config.__retryCount = config.__retryCount ?? 0;

    const isNetworkError = !error.response;
    const isServerError = error.response && error.response.status >= 500;

    // Retry only for network-level failures and 5xx server-side errors
    if ((isNetworkError || isServerError) && config.__retryCount < MAX_RETRIES) {
      config.__retryCount += 1;

      // Exponential backoff: e.g. 500ms, 1000ms, 2000ms
      const backoffDelay = Math.pow(2, config.__retryCount) * 250;
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));

      // Re-run request with incremented retry count
      return apiClient(config);
    }

    // Normalize error and reject
    return Promise.reject(normalizeError(error));
  }
);

export default apiClient;
