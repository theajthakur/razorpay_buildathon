import React from "react";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";

export type StatusType = "success" | "error" | "pending" | "untested";

export interface StatusBadgeProps {
  status: StatusType;
  message?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, message }) => {
  const configs = {
    success: {
      styles: "bg-success/10 text-success border-success/20",
      icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
      defaultMessage: "Connected",
    },
    error: {
      styles: "bg-error/10 text-error border-error/20",
      icon: <XCircle className="w-4 h-4 shrink-0" />,
      defaultMessage: "Connection Failed",
    },
    pending: {
      styles: "bg-warning/10 text-warning border-warning/20 animate-pulse",
      icon: <Loader2 className="w-4 h-4 shrink-0 animate-spin" />,
      defaultMessage: "Testing...",
    },
    untested: {
      styles: "bg-secondary/5 text-text-secondary border-border",
      icon: <AlertCircle className="w-4 h-4 shrink-0" />,
      defaultMessage: "Not Connected",
    },
  };

  const current = configs[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${current.styles}`}
    >
      {current.icon}
      <span>{message || current.defaultMessage}</span>
    </div>
  );
};
