import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: Attach Clerk User ID token dynamically from localStorage
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      let token = localStorage.getItem("clerk_user_id");
      
      // Fallback: If localStorage is empty, try to resolve user ID from global Clerk object
      if (!token && (window as any).Clerk?.user?.id) {
        token = (window as any).Clerk.user.id;
        localStorage.setItem("clerk_user_id", token!);
      }

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    // Set default retry values if not specified
    (config as any).retry = (config as any).retry ?? 3;
    (config as any).retryDelay = (config as any).retryDelay ?? 1500;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle retries on network failures or 5xx status codes
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    
    // If config does not exist or retry options are not configured
    if (!config || !config.retry) {
      return Promise.reject(error);
    }
    
    config.retryCount = config.retryCount || 0;
    
    // Check if max retry limit is exceeded
    if (config.retryCount >= config.retry) {
      return Promise.reject(error);
    }
    
    // Only retry on network errors or 5xx server status codes
    const isNetworkError = !response;
    const isServerError = response && response.status >= 500 && response.status <= 599;
    
    if (!isNetworkError && !isServerError) {
      return Promise.reject(error);
    }
    
    config.retryCount += 1;
    
    // Delay before retrying (exponential backoff helper)
    const backoffDelay = config.retryDelay * Math.pow(1.5, config.retryCount - 1);
    await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    
    // Resend request using identical apiClient config
    return apiClient(config);
  }
);

export default apiClient;
