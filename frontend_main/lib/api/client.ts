import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper: Wait for global Clerk instance to be fully loaded and initialized
const waitForClerk = (): Promise<any> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    
    // Check if Clerk is already initialized
    if ((window as any).Clerk?.isReady?.() || (window as any).Clerk?.session) {
      resolve((window as any).Clerk);
      return;
    }

    // Poll every 50ms (up to 5 seconds) to wait for Clerk initialization
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if ((window as any).Clerk?.isReady?.() || (window as any).Clerk?.session || attempts > 100) {
        clearInterval(interval);
        resolve((window as any).Clerk || null);
      }
    }, 50);
  });
};

// Request interceptor: Attach Clerk JWT token dynamically
apiClient.interceptors.request.use(
  async (config) => {
    if (typeof window !== "undefined") {
      // Asynchronously wait for Clerk to initialize
      const clerk = await waitForClerk();
      let token: string | null = null;
      
      // Retrieve signed JWT token dynamically from active Clerk session
      if (clerk?.session) {
        try {
          token = await clerk.session.getToken();
        } catch (e) {
          console.error("Failed to retrieve Clerk JWT token dynamically:", e);
        }
      }

      // Fallback: Use stored clerk_user_id if Clerk session JWT is still not available
      if (!token) {
        token = localStorage.getItem("clerk_user_id");
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
