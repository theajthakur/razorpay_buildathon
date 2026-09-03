"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Compass,
  Rocket,
  Code2,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  FileText,
  Copy,
  Check,
  Layers,
  Database,
  Lock,
  Zap,
  ChevronRight
} from "lucide-react";

interface DocumentationClientProps {
  rawMarkdown?: string;
}

export default function DocumentationClient({ rawMarkdown = "" }: DocumentationClientProps) {
  const [copiedRaw, setCopiedRaw] = useState(false);

  const handleCopyForAI = () => {
    const aiText = rawMarkdown || `# ShopAgent Developer Documentation\nOverview: Connect your e-commerce store with ShopAgent AI shopping agents.\nEndpoints: GET /products, GET /addresses, POST /orders, GET /merchant/orders/verify\nWebhooks: order.payment_completed`;
    navigator.clipboard.writeText(aiText);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="flex-1 max-w-full lg:max-w-[72ch] min-w-0 font-sans">
      
      {/* AI Copy Banner */}
      <div className="mb-8 p-4 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-text-primary">Need Docs for AI Assistant?</h4>
            <p className="text-[11px] text-text-secondary">Copy raw Markdown documentation for Cursor, Claude, or ChatGPT prompts.</p>
          </div>
        </div>
        <button
          onClick={handleCopyForAI}
          className={`px-3.5 py-1.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border ${
            copiedRaw
              ? "bg-success border-success text-text-on-primary"
              : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover"
          }`}
        >
          {copiedRaw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedRaw ? "Copied Markdown!" : "Copy for AI"}</span>
        </button>
      </div>

      <article className="prose max-w-none">
        {/* Title */}
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-4">
          ShopAgent Developer Documentation
        </h1>
        <p className="text-base text-text-secondary leading-relaxed mb-8">
          Welcome to the official developer documentation for ShopAgent. Learn how to connect your store catalog, handle customer authentication, manage API keys, process Razorpay webhooks, and perform Server-to-Server order verification.
        </p>

        {/* 4 Primary Navigation Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
          
          <Link
            href="/documentation/onboarding"
            className="p-5 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Rocket className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text-primary font-heading group-hover:text-primary transition-colors m-0 flex items-center gap-2">
                <span>1. All About Onboarding</span>
                <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Step-by-step onboarding journey: Base URL, customer auth mapping, catalog search, saved addresses, and checkout routes.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary flex items-center gap-1">
              <span>Read Onboarding Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/documentation/endpoints"
            className="p-5 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Code2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text-primary font-heading group-hover:text-primary transition-colors m-0 flex items-center gap-2">
                <span>2. Essential Endpoints</span>
                <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Full API specifications for catalog search, delivery addresses, cart orders, API key management, and S2S order verification.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary flex items-center gap-1">
              <span>Explore Endpoint Specs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/documentation/verification"
            className="p-5 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text-primary font-heading group-hover:text-primary transition-colors m-0 flex items-center gap-2">
                <span>3. Keys, Webhooks & Verify</span>
                <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                API Key security (`sk_live_...`), payment completion webhooks (`order.payment_completed`), idempotency, and S2S verification.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary flex items-center gap-1">
              <span>View Security & Verification</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/documentation/faq"
            className="p-5 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text-primary font-heading group-hover:text-primary transition-colors m-0 flex items-center gap-2">
                <span>Common FAQs & Mappings</span>
                <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Searchable FAQ accordions covering candidate key mappings, error handling, rate limits, and local sandbox testing.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary flex items-center gap-1">
              <span>Read Common FAQs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

        </div>

        <hr className="my-10 border-border" />

        {/* Architecture Overview Diagram */}
        <h2 className="font-heading text-2xl font-bold text-text-primary mb-4">
          High-Level Architecture & Flow
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          ShopAgent acts as a non-invasive conversational shopping bridge between your storefront, customer sessions, and Razorpay payment capture:
        </p>

        <div className="p-6 rounded-2xl border border-border bg-surface space-y-4 font-mono text-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="p-3.5 rounded-xl border border-border bg-background flex-1 w-full">
              <div className="font-bold text-text-primary">1. Store Frontend / Widget</div>
              <div className="text-[11px] text-text-secondary mt-1">Customer chats & selects items</div>
            </div>
            <div className="text-primary font-bold">→</div>
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/10 flex-1 w-full">
              <div className="font-bold text-primary">2. ShopAgent AI Core</div>
              <div className="text-[11px] text-text-secondary mt-1">Parses intent, searches products</div>
            </div>
            <div className="text-primary font-bold">→</div>
            <div className="p-3.5 rounded-xl border border-border bg-background flex-1 w-full">
              <div className="font-bold text-text-primary">3. Merchant Store Backend</div>
              <div className="text-[11px] text-text-secondary mt-1">Creates order & receives webhook</div>
            </div>
          </div>
        </div>

        <hr className="my-10 border-border" />

        {/* Standard HTTP Status Codes */}
        <h2 className="font-heading text-2xl font-bold text-text-primary mb-4">
          Standard API Response Status Codes
        </h2>
        <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
          <table className="min-w-full divide-y divide-border text-xs text-left">
            <thead className="bg-background text-text-primary font-semibold">
              <tr>
                <th className="px-4 py-3 font-semibold">Status Code</th>
                <th className="px-4 py-3 font-semibold">Meaning</th>
                <th className="px-4 py-3 font-semibold">Action / Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface text-text-secondary">
              <tr className="hover:bg-background/50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-success">200 OK</td>
                <td className="px-4 py-3">Success</td>
                <td className="px-4 py-3">Request processed cleanly</td>
              </tr>
              <tr className="hover:bg-background/50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-warning">400 Bad Request</td>
                <td className="px-4 py-3">Invalid Parameters</td>
                <td className="px-4 py-3">Malformed query or missing required payload key</td>
              </tr>
              <tr className="hover:bg-background/50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-error">401 Unauthorized</td>
                <td className="px-4 py-3">Authentication Failed</td>
                <td className="px-4 py-3">Missing or invalid <code>Authorization: Bearer</code> API key</td>
              </tr>
              <tr className="hover:bg-background/50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-error">404 Not Found</td>
                <td className="px-4 py-3">Resource Missing</td>
                <td className="px-4 py-3">Order ID or API Key record not found</td>
              </tr>
              <tr className="hover:bg-background/50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-error">409 Conflict</td>
                <td className="px-4 py-3">Duplicate Resource</td>
                <td className="px-4 py-3">API Key name already exists or key limit reached</td>
              </tr>
            </tbody>
          </table>
        </div>

      </article>
    </div>
  );
}
