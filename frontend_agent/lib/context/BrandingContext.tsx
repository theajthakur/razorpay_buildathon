"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchPublicBranding, BrandingConfig } from "@/lib/api/branding";

interface BrandingContextType {
  branding: BrandingConfig | null;
  brandingLoading: boolean;
  brandingError: string | null;
  primaryColor: string;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  useEffect(() => {
    async function getBranding() {
      try {
        setBrandingLoading(true);
        setBrandingError(null);
        const data = await fetchPublicBranding();
        if (!data || !data.merchant_id) {
          throw new Error("Domain mapping error. No merchant configuration found for this host.");
        }
        setBranding(data);
      } catch (error: any) {
        console.error("Branding fetch failed:", error);
        setBranding(null);
        setBrandingError(error?.message || "Domain mapping error. Unable to load store branding.");
      } finally {
        setBrandingLoading(false);
      }
    }
    getBranding();
  }, []);

  const primaryColor = branding?.brand_color || "#E24A33";

  return (
    <BrandingContext.Provider value={{ branding, brandingLoading, brandingError, primaryColor }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
};
