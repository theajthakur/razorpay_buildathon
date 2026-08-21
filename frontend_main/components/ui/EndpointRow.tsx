import React from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, StatusType } from "@/components/ui/StatusBadge";
import { ShieldCheck } from "lucide-react";

export interface EndpointRowProps {
  label: string;
  path: string;
  method: string;
  onPathChange: (val: string) => void;
  onMethodChange: (val: string) => void;
  onTest: () => void;
  testStatus: StatusType;
  disabled?: boolean;
}

export const EndpointRow: React.FC<EndpointRowProps> = ({
  label,
  path,
  method,
  onPathChange,
  onMethodChange,
  onTest,
  testStatus,
  disabled = false,
}) => {
  const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 py-4 border-b border-border last:border-b-0">
      {/* Label / Resource Name */}
      <div className="md:w-32 shrink-0">
        <span className="text-sm font-bold text-text-primary">{label}</span>
      </div>

      {/* Path input */}
      <div className="flex-1 flex items-center bg-background border border-border rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-colors">
        <span className="text-text-secondary text-sm select-none font-mono">/</span>
        <input
          type="text"
          value={path}
          onChange={(e) => onPathChange(e.target.value.replace(/^\/+/, ""))}
          placeholder="endpoint/path"
          className="w-full bg-transparent border-0 p-0 pl-1 text-sm text-text-primary placeholder:text-text-secondary focus:ring-0 focus:outline-none font-mono"
        />
      </div>

      {/* HTTP Method select dropdown */}
      <div className="md:w-28 shrink-0">
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-semibold"
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Action triggers */}
      <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onTest}
          disabled={disabled || path.trim() === "" || testStatus === "pending"}
          className="flex items-center gap-1.5"
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Test</span>
        </Button>
        <StatusBadge status={testStatus} />
      </div>
    </div>
  );
};
