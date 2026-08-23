"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, FileText, ChevronRight, Menu } from "lucide-react";

interface HeadingItem {
  id: string;
  text: string;
}

interface DocumentationClientProps {
  rawMarkdown: string;
}

// Custom JSON syntax highlighting helper
function HighlightedJson({ code }: { code: string }) {
  try {
    const html = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const highlighted = html.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "text-text-primary";
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "text-primary font-semibold"; // key
          } else {
            cls = "text-success font-medium"; // string
          }
        } else if (/true|false/.test(match)) {
          cls = "text-warning font-semibold";
        } else if (/null/.test(match)) {
          cls = "text-text-secondary/60 font-semibold";
        } else {
          cls = "text-accent font-semibold"; // number
        }
        
        if (/:$/.test(match)) {
          const keyPart = match.slice(0, -1);
          return `<span class="${cls}">${keyPart}</span><span class="text-text-secondary">:</span>`;
        }
        
        return `<span class="${cls}">${match}</span>`;
      }
    );

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  } catch (e) {
    return <>{code}</>;
  }
}

// Custom Code Block component with syntax highlighting and copy button
function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = children.trim();
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-6 group rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border text-xs text-text-secondary font-mono">
        <span>{language ? language.toUpperCase() : "CODE"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-text-primary transition-colors cursor-pointer font-sans text-xs font-medium"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success animate-in fade-in zoom-in-50 duration-200" />
              <span className="text-success font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono text-text-primary select-text leading-relaxed">
        <code>
          {className === "language-json" ? (
            <HighlightedJson code={codeText} />
          ) : (
            codeText
          )}
        </code>
      </pre>
    </div>
  );
}

export default function DocumentationClient({ rawMarkdown }: DocumentationClientProps) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeId, setActiveId] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Static headings list mapping exactly to the components
  const headings: HeadingItem[] = [
    { id: "overview", text: "Overview" },
    { id: "api-format", text: "API Format" },
    { id: "order-lifecycle", text: "Order Lifecycle" },
    { id: "webhook-orderpayment_completed", text: "Webhook: order.payment_completed" },
    { id: "verify-order", text: "Verify Order" },
    { id: "quickstart-checklist", text: "Quickstart Checklist" },
    { id: "faq", text: "FAQ" },
  ];

  // Copy raw markdown function
  const handleCopyForAI = () => {
    navigator.clipboard.writeText(rawMarkdown);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // ScrollSpy logic to highlight active section
  useEffect(() => {
    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-15% 0px -75% 0px",
        threshold: 0.1,
      }
    );

    headingElements.forEach((el) => observer.observe(el));

    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveId("overview");
      }
    };
    window.addEventListener("scroll", handleScroll);

    return () => {
      headingElements.forEach((el) => observer.unobserve(el));
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Smooth scroll handler
  const handleScrollTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    
    if (id === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = document.getElementById(id);
    if (element) {
      const offset = 90;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-10 flex-1 flex flex-col lg:flex-row gap-12 relative">
      
      {/* Table of Contents: Mobile Floating Drawer Toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-12 h-12 rounded-full bg-primary hover:bg-primary-hover text-text-on-primary flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer"
          aria-label="Table of contents menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Anchor Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-text-primary/20 backdrop-blur-xs flex justify-end">
          <div className="w-72 max-w-[80vw] bg-surface h-full p-6 shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <h3 className="font-heading font-bold text-lg text-text-primary">On This Page</h3>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto space-y-4">
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  onClick={(e) => handleScrollTo(e, heading.id)}
                  className={`block text-sm font-medium py-1.5 px-2.5 rounded-lg border-l-2 transition-all ${
                    activeId === heading.id
                      ? "border-primary text-primary bg-primary-light/50 pl-3.5"
                      : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Left Column: Content Area */}
      <div className="flex-1 max-w-full lg:max-w-[72ch] min-w-0">
        
        {/* Copy for AI Action Bar */}
        <div className="mb-8 p-4 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-primary shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-text-primary">Need this doc for AI?</h4>
              <p className="text-xs text-text-secondary">Copy the raw markdown to paste directly into cursor/claude.</p>
            </div>
          </div>
          <button
            onClick={handleCopyForAI}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 shadow-2xs border ${
              copiedAll
                ? "bg-success border-success text-text-on-primary"
                : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover hover:border-primary-hover"
            }`}
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied Markdown!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy for AI</span>
              </>
            )}
          </button>
        </div>

        {/* Documentation Content rendered directly as React Elements */}
        <article className="prose max-w-none">
          
          {/* Overview */}
          <h1 id="overview" className="font-heading text-4xl font-extrabold text-text-primary tracking-tight mb-6 scroll-mt-24">
            ShopAgent Integration Guide
          </h1>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            This guide covers everything you need to integrate your store with ShopAgent: authentication, the order lifecycle, the webhook you'll receive, and the verify endpoint you'll call to confirm payment before fulfilling an order.
          </p>

          <hr className="my-10 border-border" />

          {/* API Format */}
          <h2 id="api-format" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-4 pb-2 border-b border-border scroll-mt-24">
            API Format
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            All ShopAgent APIs share these conventions.
          </p>

          <p className="text-base text-text-primary font-bold mb-2">Base URL</p>
          <CodeBlock>
            https://api.shopagent.dev/v1
          </CodeBlock>

          <p className="text-base text-text-primary font-bold mt-8 mb-2">Authentication</p>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            Every request to ShopAgent's API includes your API key as a bearer token:
          </p>
          <CodeBlock>
            Authorization: Bearer &lt;YOUR_SHOPAGENT_API_KEY&gt;
          </CodeBlock>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            Keep this key server-side only. Never expose it in client-side code.
          </p>

          <p className="text-base text-text-primary font-bold mt-8 mb-2">Content type</p>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            All requests and responses use JSON:
          </p>
          <CodeBlock>
            Content-Type: application/json
          </CodeBlock>

          <p className="text-base text-text-primary font-bold mt-8 mb-2">Standard error format</p>
          <CodeBlock className="language-json">
{`{
  "error": {
    "code": "invalid_request",
    "message": "merchant_order_id is required"
  }
}`}
          </CodeBlock>

          <p className="text-base text-text-primary font-bold mt-8 mb-2">Common status codes</p>
          <div className="overflow-x-auto my-8 border border-border rounded-xl shadow-xs max-w-full">
            <table className="min-w-full divide-y divide-border text-sm text-left">
              <thead className="bg-background text-text-primary font-semibold border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold text-text-primary">Code</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface text-text-secondary">
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">200</code>
                  </td>
                  <td className="px-5 py-4">Success</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">400</code>
                  </td>
                  <td className="px-5 py-4">Malformed or missing request fields</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">401</code>
                  </td>
                  <td className="px-5 py-4">Missing or invalid API key</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">404</code>
                  </td>
                  <td className="px-5 py-4">Resource not found</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">409</code>
                  </td>
                  <td className="px-5 py-4">Conflict (e.g. insufficient stock)</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">429</code>
                  </td>
                  <td className="px-5 py-4">Rate limited</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">5xx</code>
                  </td>
                  <td className="px-5 py-4">ShopAgent-side error — safe to retry with backoff</td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr className="my-10 border-border" />

          {/* Order Lifecycle */}
          <h2 id="order-lifecycle" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-4 pb-2 border-b border-border scroll-mt-24">
            Order Lifecycle
          </h2>
          <CodeBlock>
{`pending → confirmed
        → failed
        → flagged_amount_mismatch`}
          </CodeBlock>

          <div className="overflow-x-auto my-8 border border-border rounded-xl shadow-xs max-w-full">
            <table className="min-w-full divide-y divide-border text-sm text-left">
              <thead className="bg-background text-text-primary font-semibold border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold text-text-primary">Status</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Meaning</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">What to do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface text-text-secondary">
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">pending</code>
                  </td>
                  <td className="px-5 py-4">Order created, payment not yet confirmed</td>
                  <td className="px-5 py-4">Wait — do not fulfill</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">confirmed</code>
                  </td>
                  <td className="px-5 py-4">Payment captured and verified</td>
                  <td className="px-5 py-4 text-success font-medium">Safe to fulfill</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">failed</code>
                  </td>
                  <td className="px-5 py-4">Payment did not succeed</td>
                  <td className="px-5 py-4">Do not fulfill; notify customer if needed</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">flagged_amount_mismatch</code>
                  </td>
                  <td className="px-5 py-4">Payment captured but amount didn't match your order total</td>
                  <td className="px-5 py-4 text-error font-medium">Do not fulfill — investigate manually</td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr className="my-10 border-border" />

          {/* Webhook */}
          <h2 id="webhook-orderpayment_completed" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-4 pb-2 border-b border-border scroll-mt-24">
            Webhook: <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-sm font-semibold">order.payment_completed</code>
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            When a payment completes, ShopAgent sends a <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">POST</code> request to the webhook URL you registered.
          </p>

          <h3 id="payload-structure" className="font-heading text-lg font-bold text-text-primary mt-8 mb-3 scroll-mt-24">
            Payload structure
          </h3>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            The webhook body is intentionally minimal — treat it as a <strong>trigger</strong>, not a data source. Full payment details must always be pulled via <a href="#verify-order" onClick={(e) => handleScrollTo(e, "verify-order")} className="text-primary hover:text-primary-hover font-medium underline transition-colors">Verify Order</a>, never trusted from the webhook body itself.
          </p>
          <CodeBlock className="language-json">
{`{
  "event": "order.payment_completed",
  "event_id": "evt_9f8a3b2c1d",
  "merchant_order_id": "ORD1234"
}`}
          </CodeBlock>

          <div className="overflow-x-auto my-8 border border-border rounded-xl shadow-xs max-w-full">
            <table className="min-w-full divide-y divide-border text-sm text-left">
              <thead className="bg-background text-text-primary font-semibold border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold text-text-primary">Field</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Type</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface text-text-secondary">
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">event</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">Always <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">"order.payment_completed"</code> for this event type</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">event_id</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">Unique ID for this event — use it to dedupe retried/duplicate deliveries</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">merchant_order_id</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">Your own order ID, as provided when the order was created</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 id="expected-response" className="font-heading text-lg font-bold text-text-primary mt-8 mb-3 scroll-mt-24">
            Expected response
          </h3>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            Return a <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">2xx</code> status quickly (within a few seconds). If you don't acknowledge, ShopAgent retries with exponential backoff.
          </p>
          <CodeBlock>
            200 OK
          </CodeBlock>

          <h3 id="idempotency" className="font-heading text-lg font-bold text-text-primary mt-8 mb-3 scroll-mt-24">
            Idempotency
          </h3>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            Webhooks may be delivered more than once for the same event. Before processing, check whether you've already seen this <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">event_id</code> and skip reprocessing if so.
          </p>

          <hr className="my-10 border-border" />

          {/* Verify Order */}
          <h2 id="verify-order" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-4 pb-2 border-b border-border scroll-mt-24">
            Verify Order
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            After receiving the webhook (or at any time you want to double-check an order), call this endpoint to get the authoritative payment status.
          </p>

          <p className="text-base text-text-primary font-bold mb-2">Endpoint</p>
          <CodeBlock>
            GET /orders/verify
          </CodeBlock>

          <h3 id="request" className="font-heading text-lg font-bold text-text-primary mt-8 mb-3 scroll-mt-24">
            Request
          </h3>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            Sent as query parameters, authenticated with your API key.
          </p>
          <CodeBlock>
{`GET /merchant/orders/verify?merchant_order_id=ORD1234
Authorization: Bearer <YOUR_SHOPAGENT_API_KEY>`}
          </CodeBlock>

          <div className="overflow-x-auto my-8 border border-border rounded-xl shadow-xs max-w-full">
            <table className="min-w-full divide-y divide-border text-sm text-left">
              <thead className="bg-background text-text-primary font-semibold border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold text-text-primary">Parameter</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Type</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Required</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface text-text-secondary">
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">merchant_order_id</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4 font-semibold text-warning">Yes</td>
                  <td className="px-5 py-4">The order ID from your own system</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 id="response-structure" className="font-heading text-lg font-bold text-text-primary mt-8 mb-3 scroll-mt-24">
            Response structure
          </h3>
          <CodeBlock className="language-json">
{`{
  "merchant_order_id": "ORD1234",
  "agent_order_id": "shopagent_ord_88221",
  "payment_status": "captured",
  "order_total": 360,
  "currency": "INR",

  "payment": {
    "razorpay_payment_id": "pay_QwErTy12345",
    "razorpay_order_id": "order_AbCdEf6789",
    "method": "upi",
    "captured_at": "2026-08-23T14:32:05Z"
  },

  "verified_at": "2026-08-23T14:35:00Z",
  "verification_source": "razorpay_api"
}`}
          </CodeBlock>

          <div className="overflow-x-auto my-8 border border-border rounded-xl shadow-xs max-w-full">
            <table className="min-w-full divide-y divide-border text-sm text-left">
              <thead className="bg-background text-text-primary font-semibold border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold text-text-primary">Field</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Type</th>
                  <th className="px-5 py-4 font-semibold text-text-primary">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface text-text-secondary">
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">merchant_order_id</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">Your order ID</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">agent_order_id</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">ShopAgent's internal order ID, for your records</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">payment_status</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">
                    One of <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">pending</code>, <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">authorized</code>, <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">captured</code>, <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">failed</code>, <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">refunded</code>
                  </td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">order_total</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">number</td>
                  <td className="px-5 py-4">Total amount for this order, in your store's currency unit</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">currency</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">ISO currency code</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">payment.razorpay_payment_id</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">Underlying payment provider's payment ID</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">payment.razorpay_order_id</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">Underlying payment provider's order ID</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">payment.method</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">Payment method used (e.g. <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">upi</code>, <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">card</code>)</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">payment.captured_at</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string (ISO 8601)</td>
                  <td className="px-5 py-4">When payment was captured</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">verified_at</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string (ISO 8601)</td>
                  <td className="px-5 py-4">When this verify call was answered</td>
                </tr>
                <tr className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-4">
                    <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">verification_source</code>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">string</td>
                  <td className="px-5 py-4">
                    Always <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">razorpay_api</code> — confirms this status was check checked against the payment provider, not read from a cache
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            <strong>Only fulfill orders where <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">payment_status</code> is <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">captured</code>.</strong> <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">authorized</code> means funds are reserved but not yet captured — do not treat this as a completed sale.
          </p>

          <hr className="my-10 border-border" />

          {/* Quickstart Checklist */}
          <h2 id="quickstart-checklist" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-4 pb-2 border-b border-border scroll-mt-24">
            Quickstart Checklist
          </h2>
          <ol className="list-decimal pl-6 mb-6 space-y-2 text-text-secondary font-sans">
            <li className="text-base leading-relaxed text-text-secondary">Get your API key from your ShopAgent dashboard.</li>
            <li className="text-base leading-relaxed text-text-secondary">Expose the store APIs ShopAgent needs (product lookup, order creation, order status).</li>
            <li className="text-base leading-relaxed text-text-secondary">Register your webhook URL to receive <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">order.payment_completed</code>.</li>
            <li className="text-base leading-relaxed text-text-secondary">On webhook receipt, dedupe by <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">event_id</code>, then call <strong>Verify Order</strong>.</li>
            <li className="text-base leading-relaxed text-text-secondary">Fulfill only when <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">payment_status</code> is <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">captured</code> and <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">order_total</code> matches what you expect.</li>
          </ol>

          <hr className="my-10 border-border" />

          {/* FAQ */}
          <h2 id="faq" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-4 pb-2 border-b border-border scroll-mt-24">
            FAQ
          </h2>
          <p className="text-base text-text-primary font-bold mt-6 mb-2">What if I miss a webhook?</p>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            Call Verify Order directly with your <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">merchant_order_id</code> at any time — you don't need to wait for or rely solely on the webhook.
          </p>

          <p className="text-base text-text-primary font-bold mt-6 mb-2">What amount unit is used?</p>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">order_total</code> is in your store's standard currency unit (e.g. rupees, not paise) unless otherwise noted for a specific field.
          </p>

          <p className="text-base text-text-primary font-bold mt-6 mb-2">Should I trust the webhook body for order details?</p>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            No. The webhook only tells you <em>something</em> happened for a given <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">merchant_order_id</code>. Always confirm details via Verify Order before taking action.
          </p>

        </article>
      </div>

      {/* Right Column: Sticky Table of Contents Sidebar (Desktop only) */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
        <div className="border-l border-border pl-6 space-y-5">
          <h3 className="font-heading font-bold text-sm text-text-primary uppercase tracking-wider">
            On this page
          </h3>
          <nav className="flex flex-col space-y-3">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                onClick={(e) => handleScrollTo(e, heading.id)}
                className={`text-sm font-medium transition-all duration-200 flex items-center gap-2 group py-0.5 ${
                  activeId === heading.id
                    ? "text-primary pl-1 font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <ChevronRight 
                  className={`w-3.5 h-3.5 text-primary shrink-0 transition-all duration-200 ${
                    activeId === heading.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
                  }`} 
                />
                <span className="truncate">{heading.text}</span>
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}
