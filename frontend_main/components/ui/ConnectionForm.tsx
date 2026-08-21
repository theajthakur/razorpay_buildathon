import React from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { StatusBadge, StatusType } from "@/components/ui/StatusBadge";
import { ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";

export interface ConnectionData {
  baseUrl: string;
  authMethod: string;
  credentialValue: string;
}

export interface ConnectionFormProps {
  apiName: string;
  description: string;
  values: ConnectionData;
  onChange: (updated: Partial<ConnectionData>) => void;
  onTestConnection: () => void;
  testStatus: StatusType;
  onNext: () => void;
  onBack?: () => void;
  isFirstStep?: boolean;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  apiName,
  description,
  values,
  onChange,
  onTestConnection,
  testStatus,
  onNext,
  onBack,
  isFirstStep = false,
}) => {
  const isFormValid =
    values.baseUrl.trim() !== "" &&
    values.authMethod !== "" &&
    values.credentialValue.trim() !== "";

  return (
    <Card title={`${apiName} API Connection`} description={description}>
      <div className="space-y-6">
        {/* Base URL */}
        <Input
          label="API Base URL"
          placeholder={`https://api.store.com/v1/${apiName.toLowerCase()}`}
          value={values.baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value })}
          required
        />

        {/* Auth Method Select */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Authentication Method
          </label>
          <select
            value={values.authMethod}
            onChange={(e) => onChange({ authMethod: e.target.value })}
            className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
          >
            <option value="apikey">API Key</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
          </select>
        </div>

        {/* Credential Value */}
        <Input
          label={
            values.authMethod === "basic"
              ? "Username:Password (Base64)"
              : values.authMethod === "bearer"
              ? "Bearer Token"
              : "API Key Header Value"
          }
          type="password"
          placeholder={
            values.authMethod === "bearer" ? "eyJhbGciOi..." : "key_live_..."
          }
          value={values.credentialValue}
          onChange={(e) => onChange({ credentialValue: e.target.value })}
          required
        />

        {/* Connection Testing Actions */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onTestConnection}
              disabled={!isFormValid || testStatus === "pending"}
              className="flex items-center gap-2"
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>Test Connection</span>
            </Button>
            <StatusBadge status={testStatus} />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {!isFirstStep && onBack && (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              onClick={onNext}
              disabled={!isFormValid || testStatus !== "success"}
              className="flex items-center gap-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
