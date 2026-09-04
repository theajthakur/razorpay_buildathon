"use client";

import React from "react";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { DomainStatus } from "@/lib/api/domain";

interface DomainStatusBadgeProps {
  status: DomainStatus | string;
  className?: string;
}

export const DomainStatusBadge: React.FC<DomainStatusBadgeProps> = ({ status, className = "" }) => {
  const normalizedStatus = (status || "").toUpperCase();

  if (normalizedStatus === "ACTIVE") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30 shadow-2xs shrink-0 whitespace-nowrap ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Active</span>
      </span>
    );
  }

  if (normalizedStatus === "FAILED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-error/15 text-error border border-error/30 shadow-2xs shrink-0 whitespace-nowrap ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>Failed</span>
      </span>
    );
  }

  // Default: PENDING
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning border border-warning/30 shadow-2xs shrink-0 whitespace-nowrap ${className}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
      </span>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Pending DNS</span>
    </span>
  );
};
