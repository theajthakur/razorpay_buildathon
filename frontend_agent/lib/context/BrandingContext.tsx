"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchPublicBranding, BrandingConfig } from "@/lib/api/branding";

interface BrandingContextType {
  branding: BrandingConfig | null;
  brandingLoading: boolean;
  primaryColor: string;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);

  useEffect(() => {
    async function getBranding() {
      try {
        setBrandingLoading(true);
        const data = await fetchPublicBranding();
        setBranding(data);
      } catch (error) {
        console.warn("Branding fetch failed, using default Ponion placeholders:", error);
        setBranding(null);
      } finally {
        setBrandingLoading(false);
      }
    }
    getBranding();
  }, []);

  const primaryColor = branding?.brand_color || "#E24A33";

  return (
    <BrandingContext.Provider value={{ branding, brandingLoading, primaryColor }}>
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
