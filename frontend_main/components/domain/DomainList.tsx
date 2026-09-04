"use client";

import React, { useState } from "react";
import { Globe, RefreshCw, Trash2, ChevronDown, ChevronUp, ExternalLink, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DomainResponse, verifyDomain } from "@/lib/api/domain";
import { DomainStatusBadge } from "./DomainStatusBadge";
import { DnsDetailsCard } from "./DnsDetailsCard";

interface DomainListProps {
  domains: DomainResponse[];
  onVerifySuccess: (updatedDomain: DomainResponse) => void;
  onDeleteTrigger: (domainId: string, domainName: string) => void;
}

export const DomainList: React.FC<DomainListProps> = ({
  domains,
  onVerifySuccess,
  onDeleteTrigger,
}) => {
  const [expandedDomainId, setExpandedDomainId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<{ id: string; msg: string } | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedDomainId(expandedDomainId === id ? null : id);
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    setVerifyError(null);

    try {
      const updated = await verifyDomain(id);
      onVerifySuccess(updated);
    } catch (err: any) {
      console.error("Failed to verify domain:", err);
      const msg = err.response?.data?.detail || err.message || "Verification check failed.";
      setVerifyError({ id, msg });
    } finally {
      setVerifyingId(null);
    }
  };

  if (domains.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-surface/40 space-y-4 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Globe className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className="font-heading text-base font-bold text-text-primary">
            No Custom Domains Added Yet
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Connect a custom domain (e.g. <span className="font-mono text-text-primary font-semibold">agent.yourstore.com</span>) to host your ShopAgent storefront widget.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      {domains.map((item) => {
        const isExpanded = expandedDomainId === item.id;
        const isVerifying = verifyingId === item.id;
        const hasError = verifyError?.id === item.id;

        return (
          <div
            key={item.id}
            className="border border-border bg-surface rounded-2xl overflow-hidden shadow-2xs transition-all hover:border-border/80"
          >
            {/* Main Row */}
            <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Domain Name & Info */}
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="font-mono font-bold text-sm sm:text-base text-text-primary">
                      {item.domain}
                    </h4>
                    <DomainStatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-text-secondary mt-1 flex items-center gap-2">
                    <span>Added {item.created_at ? new Date(item.created_at).toLocaleDateString() : "recently"}</span>
                    {item.updated_at && (
                      <>
                        <span>•</span>
                        <span>Updated {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Row Action Controls */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end">
                {/* Expand / Collapse DNS Details */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toggleExpand(item.id)}
                  className="gap-1.5 text-xs border border-border bg-background"
                >
                  <span>DNS Setup</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </Button>

                {/* Trigger Verification Check */}
                <Button
                  type="button"
                  onClick={() => handleVerify(item.id)}
                  disabled={isVerifying}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                  <span>{isVerifying ? "Verifying..." : "Verify DNS"}</span>
                </Button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => onDeleteTrigger(item.id, item.domain)}
                  className="p-2 rounded-xl text-text-secondary hover:text-error hover:bg-error/10 border border-border transition-colors cursor-pointer"
                  title="Delete Domain"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error Banner if verification failed inline */}
            {hasError && (
              <div className="px-5 py-2.5 bg-error/10 border-t border-error/20 text-xs text-error font-medium">
                {verifyError.msg}
              </div>
            )}

            {/* Expandable DNS Instructions Card */}
            {isExpanded && (
              <div className="p-5 border-t border-border bg-background/50 animate-in slide-in-from-top-2 duration-200">
                <DnsDetailsCard domain={item.domain} dnsDetails={item.dns_details} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
