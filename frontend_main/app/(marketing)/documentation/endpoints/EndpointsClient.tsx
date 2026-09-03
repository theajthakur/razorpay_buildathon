"use client";

import React, { useState, useEffect } from "react";
import {
  Code2,
  Copy,
  Check,
  ChevronRight,
  Menu,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  ShoppingCart,
  RefreshCw,
  Database
} from "lucide-react";

interface HeadingItem {
  id: string;
  text: string;
}

function CodeBlock({ children, label = "CODE SNIPPET" }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = children.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 group rounded-xl border border-border bg-surface shadow-xs overflow-hidden font-sans">
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border text-xs text-text-secondary font-mono">
        <span className="font-semibold">{label}</span>
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
      <pre className="p-4 overflow-x-auto text-sm font-mono text-text-primary select-text leading-relaxed bg-surface">
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" | "PATCH" | "DELETE" }) {
  const styles = {
    GET: "bg-success/15 text-success border-success/30",
    POST: "bg-primary/15 text-primary border-primary/30",
    PATCH: "bg-warning/15 text-warning border-warning/30",
    DELETE: "bg-error/15 text-error border-error/30",
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-bold uppercase select-none ${styles[method]}`}>
      {method}
    </span>
  );
}

export default function EndpointsClient() {
  const [activeId, setActiveId] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const headings: HeadingItem[] = [
    { id: "overview", text: "Endpoints Overview" },
    { id: "store-catalog", text: "Product Catalog Search" },
    { id: "store-addresses", text: "Saved Addresses API" },
    { id: "store-checkout", text: "Order Creation API" },
    { id: "dashboard-keys", text: "API Key Management" },
    { id: "s2s-verify", text: "S2S Payment Verification" },
    { id: "payment-callback", text: "Razorpay Signature Callback" },
    { id: "payment-retry", text: "Payment Retry API" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;

      if (window.scrollY < 100) {
        setActiveId("overview");
        return;
      }

      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 50) {
        setActiveId(headings[headings.length - 1].id);
        return;
      }

      for (let i = headings.length - 1; i >= 0; i--) {
        const element = document.getElementById(headings[i].id);
        if (element) {
          if (scrollPosition >= element.offsetTop) {
            setActiveId(headings[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

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

  const handleCopyMarkdown = () => {
    const markdown = `# Essential Endpoints for Agentic E-Commerce
GET /products?query=...
GET /customer/addresses
POST /orders
POST /api/dashboard/keys
GET /merchant/orders/verify?merchant_order_id=...
POST /agentic/payments/verify`;
    navigator.clipboard.writeText(markdown);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <>
      {/* Mobile Drawer Toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-12 h-12 rounded-full bg-primary text-text-on-primary flex items-center justify-center shadow-lg transition-all cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-text-primary/20 backdrop-blur-xs flex justify-end">
          <div className="w-72 max-w-[80vw] bg-surface h-full p-6 shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <h3 className="font-heading font-bold text-lg text-text-primary">Endpoints Index</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="text-text-secondary hover:text-text-primary text-sm font-semibold">
                Close
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto space-y-3">
              {headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  onClick={(e) => handleScrollTo(e, h.id)}
                  className={`block text-xs font-medium py-1.5 px-2 rounded-lg border-l-2 ${
                    activeId === h.id ? "border-primary text-primary bg-primary/10 pl-3 font-bold" : "border-transparent text-text-secondary"
                  }`}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 max-w-full lg:max-w-[72ch] min-w-0 font-sans">
        
        {/* Action Header */}
        <div className="mb-8 p-4 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary">Essential E-Commerce API Specifications</h4>
              <p className="text-[11px] text-text-secondary">Authoritative API references, schemas, and verification parameters.</p>
            </div>
          </div>
          <button
            onClick={handleCopyMarkdown}
            className={`px-3.5 py-1.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border ${
              copiedRaw ? "bg-success border-success text-text-on-primary" : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover"
            }`}
          >
            {copiedRaw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRaw ? "Copied Endpoint Specs!" : "Copy Endpoint Specs"}</span>
          </button>
        </div>

        <article className="prose max-w-none">
          <h1 id="overview" className="font-heading text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-4 scroll-mt-24">
            Essential Endpoints for Agentic E-Commerce
          </h1>
          <p className="text-base text-text-secondary leading-relaxed mb-6">
            This reference details all endpoints required for store integration and platform operations. Endpoints are divided into <strong>Store Resources</strong> (exposed by merchant) and <strong>ShopAgent APIs</strong> (provided by platform).
          </p>

          <hr className="my-10 border-border" />

          {/* 1. Catalog Search */}
          <section id="store-catalog" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <MethodBadge method="GET" />
                <h2 className="font-heading text-xl font-bold text-text-primary m-0">Product Catalog Search</h2>
              </div>
              <span className="text-xs font-mono text-text-secondary">Store API</span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Invoked by ShopAgent when customers query products in chat. Performs keyword search against your store catalog.
            </p>

            <CodeBlock label="REQUEST PATH">
              {`GET /api/products?query=running+shoes`}
            </CodeBlock>

            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary mt-4 mb-2">Query Parameters</h4>
            <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-background text-text-primary font-semibold">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Parameter</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Required</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-text-secondary">
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-primary">query</td>
                    <td className="px-4 py-3 font-mono">string</td>
                    <td className="px-4 py-3 text-warning font-bold">Yes</td>
                    <td className="px-4 py-3">User's product search query terms</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock label="RESPONSE SCHEMA (200 OK)">
              {`{
  "products": [
    {
      "id": "prod_101",
      "name": "Air Cushion Running Shoes",
      "description": "Lightweight mesh upper with shock absorption.",
      "price": 2499.00,
      "thumbnailUrl": "https://cdn.yourstore.com/shoes.jpg",
      "currency": "INR"
    }
  ]
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* 2. Saved Addresses */}
          <section id="store-addresses" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <MethodBadge method="GET" />
                <h2 className="font-heading text-xl font-bold text-text-primary m-0">Saved Delivery Addresses</h2>
              </div>
              <span className="text-xs font-mono text-text-secondary">Store API</span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Fetches saved delivery addresses for an authenticated customer during chat checkout setup.
            </p>

            <CodeBlock label="REQUEST HEADER & PATH">
              {`GET /api/customer/addresses
Authorization: Bearer <customer_session_jwt>`}
            </CodeBlock>

            <CodeBlock label="RESPONSE SCHEMA (200 OK)">
              {`{
  "addresses": [
    {
      "id": "addr_991",
      "flat_no": "Flat 402, Sunshine Apartments",
      "street": "MG Road, Sector 14",
      "city": "Gurugram",
      "district": "Gurugram",
      "state": "Haryana",
      "pincode": "122001",
      "is_default": true
    }
  ]
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* 3. Order Creation */}
          <section id="store-checkout" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <MethodBadge method="POST" />
                <h2 className="font-heading text-xl font-bold text-text-primary m-0">Order Creation Route</h2>
              </div>
              <span className="text-xs font-mono text-text-secondary">Store API</span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Places an order on your store backend when the customer confirms checkout in the agent chat.
            </p>

            <CodeBlock label="REQUEST BODY SCHEMA">
              {`POST /api/orders
Authorization: Bearer <customer_session_jwt>
Content-Type: application/json

{
  "cart": [
    {
      "product_id": "prod_101",
      "price": 2499.00,
      "quantity": 1
    }
  ],
  "address_id": "addr_991",
  "source": "shopagent"
}`}
            </CodeBlock>

            <CodeBlock label="EXPECTED STORE RESPONSE">
              {`{
  "merchant_order_id": "ORD99823",
  "order_total": 2499.00,
  "currency": "INR",
  "status": "created"
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* 4. API Key Management */}
          <section id="dashboard-keys" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <MethodBadge method="POST" />
                <h2 className="font-heading text-xl font-bold text-text-primary m-0">Create Merchant API Key</h2>
              </div>
              <span className="text-xs font-mono text-primary font-bold">ShopAgent Platform API</span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Generates a new Server-to-Server API key (<code>sk_live_...</code>). Returns the raw secret key <strong>exactly once</strong> upon creation.
            </p>

            <CodeBlock label="REQUEST BODY: POST /api/dashboard/keys">
              {`POST /api/dashboard/keys
Authorization: Bearer <merchant_auth_token>
Content-Type: application/json

{
  "name": "Production Backend Key"
}`}
            </CodeBlock>

            <CodeBlock label="RESPONSE SCHEMA (201 CREATED)">
              {`{
  "id": "key_uuid_7712",
  "name": "Production Backend Key",
  "key_prefix": "abc123",
  "api_key": "sk_live_abc123_randomsecretbyteshere",
  "status": "active",
  "created_at": "2026-09-03T20:30:00Z"
}`}
            </CodeBlock>

            <div className="p-4 rounded-xl border border-info/30 bg-info/5 text-xs text-text-secondary space-y-1">
              <div className="font-bold text-info">API Key Limit & Security Rules:</div>
              <div>• Maximum of 5 API keys per merchant account.</div>
              <div>• Key names must be unique across active and paused keys.</div>
              <div>• The raw secret key is never stored in plaintext and cannot be retrieved again.</div>
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* 5. S2S Order Verification */}
          <section id="s2s-verify" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <MethodBadge method="GET" />
                <h2 className="font-heading text-xl font-bold text-text-primary m-0">Server-to-Server Order Verification</h2>
              </div>
              <span className="text-xs font-mono text-primary font-bold">ShopAgent Platform API</span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Called by merchant backends after receiving a payment webhook to verify payment authenticity directly with ShopAgent and Razorpay.
            </p>

            <CodeBlock label="REQUEST DISPATCH">
              {`GET /merchant/orders/verify?merchant_order_id=ORD99823
Authorization: Bearer sk_live_abc123_randomsecretbyteshere`}
            </CodeBlock>

            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary mt-4 mb-2">Query Parameters</h4>
            <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-background text-text-primary font-semibold">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Parameter</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Required</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-text-secondary">
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-primary">merchant_order_id</td>
                    <td className="px-4 py-3 font-mono">string</td>
                    <td className="px-4 py-3 text-warning font-bold">Yes</td>
                    <td className="px-4 py-3">Your internal order ID created during checkout</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock label="VERIFIED RESPONSE SCHEMA (200 OK)">
              {`{
  "payment": {
    "status": "captured",
    "razorpay_payment_id": "pay_QwErTy12345"
  },
  "data": {
    "order": {
      "order_total": 2499.00
    }
  }
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* 6. Payment Signature Callback */}
          <section id="payment-callback" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <MethodBadge method="POST" />
                <h2 className="font-heading text-xl font-bold text-text-primary m-0">Razorpay Signature Verification Callback</h2>
              </div>
              <span className="text-xs font-mono text-primary font-bold">ShopAgent Platform API</span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Invoked by the store frontend widget after a customer completes Razorpay payment. Validates HMAC SHA256 signature and triggers the <code>order.payment_completed</code> webhook to the merchant.
            </p>

            <CodeBlock label="REQUEST BODY: POST /agentic/payments/verify">
              {`POST /agentic/payments/verify
Content-Type: application/json

{
  "razorpay_order_id": "order_AbCdEf6789",
  "razorpay_payment_id": "pay_QwErTy12345",
  "razorpay_signature": "460d3a5a782b1c9e..."
}`}
            </CodeBlock>

            <CodeBlock label="RESPONSE SCHEMA (200 OK)">
              {`{
  "status": "captured",
  "agent_order_id": "order_uuid_1092",
  "merchant_order_id": "ORD99823",
  "razorpay_order_id": "order_AbCdEf6789",
  "razorpay_payment_id": "pay_QwErTy12345",
  "payment_status": "payment_captured",
  "amount": 2499.00,
  "currency": "INR",
  "message": "Payment verified and captured successfully."
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* 7. Payment Retry */}
          <section id="payment-retry" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <MethodBadge method="POST" />
                <h2 className="font-heading text-xl font-bold text-text-primary m-0">Payment Retry API</h2>
              </div>
              <span className="text-xs font-mono text-primary font-bold">ShopAgent Platform API</span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Re-initiates payment for an existing order if a previous payment attempt failed or timed out. Reuses the existing order record without creating duplicate merchant orders.
            </p>

            <CodeBlock label="REQUEST BODY: POST /agentic/payments/retry">
              {`POST /agentic/payments/retry
Authorization: Bearer <customer_session_jwt>
Content-Type: application/json

{
  "agent_order_id": "order_uuid_1092"
}`}
            </CodeBlock>
          </section>

        </article>
      </div>

      {/* Right Column Table of Contents */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 font-sans">
        <div className="border-l border-border pl-5 space-y-4">
          <h3 className="font-heading font-bold text-xs text-text-primary uppercase tracking-wider">
            Endpoints Index
          </h3>
          <nav className="flex flex-col space-y-2">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                onClick={(e) => handleScrollTo(e, heading.id)}
                className={`text-xs font-medium transition-all duration-200 flex items-center gap-2 group py-0.5 ${
                  activeId === heading.id ? "text-primary pl-1 font-semibold" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <ChevronRight
                  className={`w-3 h-3 text-primary shrink-0 transition-all duration-200 ${
                    activeId === heading.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
                  }`}
                />
                <span className="truncate">{heading.text}</span>
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
