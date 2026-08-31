"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Globe } from "lucide-react";

export function InvalidDomainState() {
  const [currentHost, setCurrentHost] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentHost(window.location.host);
    }
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 w-full max-w-xl mx-auto min-h-[70vh] font-sans text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mb-6 shadow-xs">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-700 text-xs font-mono font-medium mb-4">
        <Globe className="w-3.5 h-3.5 text-secondary-500" />
        <span>{currentHost || "Unknown Domain"}</span>
      </div>

      <h2 className="text-2xl font-extrabold text-secondary-900 tracking-tight mb-3">
        Domain Configuration Not Found
      </h2>

      <p className="text-secondary-600 text-sm leading-relaxed mb-6 max-w-md">
        No active merchant configuration is mapped to this domain host. Please configure domain mapping in your merchant admin dashboard.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs">
        <button
          onClick={handleRefresh}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-secondary-900 hover:bg-secondary-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    </div>
  );
}

export default InvalidDomainState;
