import { useState, useEffect } from "react";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function useRazorpayScript() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Razorpay) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);
  }, []);

  return { loaded, failed };
}
