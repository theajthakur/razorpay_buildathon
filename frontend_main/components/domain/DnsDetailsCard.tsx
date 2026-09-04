"use client";

import React, { useState } from "react";
import { Copy, Check, Info, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import { DnsDetails, DnsVerificationItem } from "@/lib/api/domain";

interface DnsDetailsCardProps {
  domain: string;
  dnsDetails?: DnsDetails | null;
  className?: string;
}

export const DnsDetailsCard: React.FC<DnsDetailsCardProps> = ({ domain, dnsDetails, className = "" }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Extract Vercel verification records if available
  const verificationList: DnsVerificationItem[] = dnsDetails?.verification || [];

  // Determine standard CNAME subdomain / host name
  const isApex = !domain.includes(".") || domain.split(".").length === 2;
  const subdomain = isApex ? "@" : domain.split(".")[0];

  // Extract dynamic CNAME target returned by Vercel (e.g. e493a233eec4285d.vercel-dns-017.com)
  const vercelCnameTarget = (() => {
    if (dnsDetails?.cname_target) {
      return dnsDetails.cname_target.replace(/\.$/, "");
    }
    if (dnsDetails?.recommendedCNAME && dnsDetails.recommendedCNAME.length > 0) {
      const rank1 = dnsDetails.recommendedCNAME.find((item) => item.rank === 1) || dnsDetails.recommendedCNAME[0];
      if (rank1?.value) {
        return rank1.value.replace(/\.$/, "");
      }
    }
    if (dnsDetails?.cnames && dnsDetails.cnames.length > 0) {
      return dnsDetails.cnames[0].replace(/\.$/, "");
    }
    return "cname.vercel-dns.com";
  })();

  return (
    <div className={`p-4 sm:p-6 rounded-2xl border border-border bg-background space-y-5 sm:space-y-6 font-sans min-w-0 ${className}`}>
      {/* Header banner */}
      <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-primary/10 border border-primary/20 text-text-primary min-w-0">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm min-w-0 flex-1">
          <p className="font-semibold font-heading text-text-primary leading-snug">
            DNS Configuration Required for <span className="font-mono text-primary font-bold break-all">{domain}</span>
          </p>
          <p className="text-text-secondary leading-relaxed">
            Log in to your DNS provider (Cloudflare, GoDaddy, Namecheap, Google Domains) and add the DNS record listed below to point your custom domain to ShopAgent.
          </p>
        </div>
      </div>

      {/* Record requirements table */}
      <div className="space-y-4 min-w-0">
        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider font-heading">
          Required DNS Records
        </h4>

        <div className="space-y-3 min-w-0">
          {/* CNAME Target Record */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 text-xs min-w-0">
              <div className="min-w-0">
                <span className="text-text-secondary block font-medium">Type</span>
                <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px] uppercase inline-block mt-0.5">
                  CNAME
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-text-secondary block font-medium">Name / Host</span>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="font-mono font-semibold text-text-primary truncate min-w-0 flex-1">
                    {subdomain}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(subdomain, "name-cname")}
                    className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-background transition-colors cursor-pointer shrink-0"
                    title="Copy Host"
                  >
                    {copiedKey === "name-cname" ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="min-w-0">
                <span className="text-text-secondary block font-medium">Value / Target</span>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="font-mono font-semibold text-text-primary truncate min-w-0 flex-1" title={vercelCnameTarget}>
                    {vercelCnameTarget}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(vercelCnameTarget, "val-cname")}
                    className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-background transition-colors cursor-pointer shrink-0"
                    title="Copy Target Value"
                  >
                    {copiedKey === "val-cname" ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Verification TXT / Challenge Records if provided by Vercel */}
          {verificationList.map((record, index) => (
            <div
              key={index}
              className="p-3.5 sm:p-4 rounded-xl border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 text-xs min-w-0">
                <div className="min-w-0">
                  <span className="text-text-secondary block font-medium">Type</span>
                  <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px] uppercase inline-block mt-0.5">
                    {record.type || "TXT"}
                  </span>
                </div>

                <div className="min-w-0">
                  <span className="text-text-secondary block font-medium">Name / Host</span>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className="font-mono font-semibold text-text-primary truncate min-w-0 flex-1">
                      {record.domain || subdomain}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(record.domain || subdomain, `name-txt-${index}`)}
                      className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-background transition-colors cursor-pointer shrink-0"
                      title="Copy Name"
                    >
                      {copiedKey === `name-txt-${index}` ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="text-text-secondary block font-medium">Value / Target</span>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className="font-mono font-semibold text-text-primary truncate min-w-0 flex-1" title={record.value}>
                      {record.value}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(record.value, `val-txt-${index}`)}
                      className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-background transition-colors cursor-pointer shrink-0"
                      title="Copy Value"
                    >
                      {copiedKey === `val-txt-${index}` ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step by Step Setup Instructions */}
      <div className="border-t border-border pt-5 space-y-3 text-xs">
        <h5 className="font-semibold text-text-primary font-heading flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Setup Steps for Registrar DNS</span>
        </h5>
        <ol className="space-y-2 text-text-secondary list-decimal list-inside pl-1 leading-relaxed">
          <li>Sign in to your domain registrar (e.g. Cloudflare, GoDaddy, Namecheap).</li>
          <li>Find the <strong className="text-text-primary">DNS Management</strong> or <strong className="text-text-primary">Name Server Settings</strong> section for your domain.</li>
          <li>Create a new DNS record with the <strong className="text-text-primary">Type</strong>, <strong className="text-text-primary">Host/Name</strong>, and <strong className="text-text-primary">Value</strong> shown above.</li>
          <li>Save the record. Propagation typically takes 1–5 minutes (up to 24 hours depending on TTL).</li>
        </ol>
      </div>
    </div>
  );
};
