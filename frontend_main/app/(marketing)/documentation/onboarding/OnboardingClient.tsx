"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  Menu,
  Sparkles,
  Link2,
  FileCode,
  Building2,
  Layers,
  ArrowRight,
  Globe,
  Key,
  ShoppingCart,
  Database,
  Lock,
  Zap,
  HelpCircle
} from "lucide-react";
import { OnboardingResponse } from "@/lib/api/onboarding";

interface OnboardingClientProps {
  onboarding: OnboardingResponse | null;
}

interface HeadingItem {
  id: string;
  text: string;
}

// Custom Code Block component with copy button
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

function formatEndpointUrl(baseUrl: string, pathOrUrl?: string | null): string {
  if (!pathOrUrl) return baseUrl;
  let target = pathOrUrl.trim();

  if (/^https?:\/\//i.test(target)) {
    if (target.includes("placeholder")) {
      return target.replace(/^https?:\/\/[^\/]+/i, baseUrl);
    }
    return target;
  }

  const path = target.startsWith("/") ? target : `/${target}`;
  return `${baseUrl}${path}`;
}

const defaultOnboarding = {
  base_url: "https://api.yourstore.com",
  auth_enabled: true,
  auth_config: {
    auth_url: "/api/auth/login",
    method: "POST",
    identifier_field: "email",
    identifier_type: "Email",
    password_field: "password",
    token_path: "data.token",
    token_delivery: {
      method: "header",
      header_name: "Authorization",
      bearer_prefix: true,
      cookie_name: "token"
    }
  },
  products_config: {
    path: "/api/products",
    method: "GET",
    payload_key: "query",
    response_key: "products"
  },
  order_history_config: {
    path: "/api/orders",
    method: "GET",
    response_key: "orders"
  },
  customer_profile_config: {
    path: "/api/customer/profile",
    method: "GET"
  },
  addresses_config: {
    fetch_path: "/api/customer/addresses",
    fetch_method: "GET",
    fetch_response_key: "addresses",
    create_path: "/api/customer/addresses",
    create_method: "POST",
    create_fields: "line1,line2,city,state,pincode"
  },
  create_order_config: {
    path: "/api/orders",
    method: "POST",
    cart_key: "cart",
    item_id_field: "product_id",
    price_field: "price",
    quantity_field: "quantity",
    address_id_field: "address_id",
    additional_fields: [
      { key: "source", value: "shopagent" }
    ]
  },
  webhook_url: "https://yourstore.com/api/webhooks/shopagent",
  bank_account: "",
  ifsc: "",
  branch_name: ""
};

export default function OnboardingClient({ onboarding }: OnboardingClientProps) {
  const [activeId, setActiveId] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Merge loaded onboarding configuration with default templates for rendering fallback
  const merged = {
    ...defaultOnboarding,
    ...onboarding,
    auth_config: {
      ...defaultOnboarding.auth_config,
      ...(onboarding?.auth_config || {})
    },
    products_config: {
      ...defaultOnboarding.products_config,
      ...(onboarding?.products_config || {})
    },
    order_history_config: {
      ...defaultOnboarding.order_history_config,
      ...(onboarding?.order_history_config || {})
    },
    customer_profile_config: {
      ...defaultOnboarding.customer_profile_config,
      ...(onboarding?.customer_profile_config || {})
    },
    addresses_config: {
      ...defaultOnboarding.addresses_config,
      ...(onboarding?.addresses_config || {})
    },
    create_order_config: {
      ...defaultOnboarding.create_order_config,
      ...(onboarding?.create_order_config || {})
    },
  };

  const cleanBaseUrl = merged.base_url && !merged.base_url.includes("placeholder")
    ? merged.base_url.replace(/\/$/, "")
    : "https://api.yourstore.com";

  const cleanWebhookUrl = formatEndpointUrl(cleanBaseUrl, merged.webhook_url);

  // Headings for scroll-spy nav
  const headings: HeadingItem[] = [
    { id: "overview", text: "Overview & Journey Steps" },
    { id: "step1-baseurl", text: "Step 1. Store Base URL Setup" },
    { id: "step2-auth", text: "Step 2. Customer Auth Mapping" },
    { id: "step3-catalog", text: "Step 3. Product Catalog Search" },
    { id: "step4-addresses", text: "Step 4. Delivery Addresses" },
    { id: "step5-checkout", text: "Step 5. Order Creation Route" },
    { id: "step6-webhook", text: "Step 6. Webhook Configuration" },
    { id: "step7-apikeys", text: "Step 7. API Keys & Verification" },
    { id: "key-mappings", text: "Key Mappings & Fallback Candidates" },
    { id: "troubleshooting", text: "Troubleshooting FAQ" },
  ];

  // ScrollSpy logic to highlight active section on scroll
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
    const markdownText = `# ShopAgent Merchant Onboarding Guide\nBase URL: ${cleanBaseUrl}\nWebhook URL: ${cleanWebhookUrl}\nAPI Keys: sk_live_...\nVerify Endpoint: GET /merchant/orders/verify?merchant_order_id=...`;
    navigator.clipboard.writeText(markdownText);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <>
      {/* Mobile Anchor Navigation Drawer Overlay */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-12 h-12 rounded-full bg-primary text-text-on-primary flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer"
          aria-label="Table of contents menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

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
                  className={`block text-sm font-medium py-1.5 px-2.5 rounded-lg border-l-2 transition-all ${activeId === heading.id
                    ? "border-primary text-primary bg-primary/10 pl-3.5"
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

      {/* Main Content Area */}
      <div className="flex-1 max-w-full lg:max-w-[72ch] min-w-0 font-sans">

        {/* Copy Markdown Header Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary">Complete Merchant Setup Guide</h4>
              <p className="text-[11px] text-text-secondary">Copy onboarding specs for AI development or Cursor prompt.</p>
            </div>
          </div>
          <button
            onClick={handleCopyMarkdown}
            className={`px-3.5 py-1.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 border ${copiedRaw
              ? "bg-success border-success text-text-on-primary"
              : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover"
              }`}
          >
            {copiedRaw ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied Specs!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy for AI</span>
              </>
            )}
          </button>
        </div>

        <article className="prose max-w-none">
          {/* Welcome / Header */}
          <h1 id="overview" className="font-heading text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-4 scroll-mt-24">
            All About Merchant Onboarding
          </h1>
          <p className="text-base text-text-secondary leading-relaxed mb-6">
            ShopAgent acts as a smart, conversational layer over your existing e-commerce backend. You do <strong>not</strong> need to rewrite your cart, authentication, or checkout database. You simply map <strong>ShopAgent to your existing endpoints</strong>.
          </p>

          {/* 8-Step Timeline Overview */}
          <div className="my-8 p-6 rounded-2xl border border-border bg-surface space-y-4 grid grid-cols-1 gap-4">
            <h3 className="text-base font-bold text-text-primary font-heading m-0 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <span>The 8-Step Onboarding Journey</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <a href="#step1-baseurl" onClick={(e) => handleScrollTo(e, "step1-baseurl")} className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold font-mono flex items-center justify-center text-xs">1</span>
                <div>
                  <div className="font-bold text-text-primary">Base URL Setup</div>
                  <div className="text-[11px] text-text-secondary">HTTPS Root Host Domain</div>
                </div>
              </a>

              <a href="#step2-auth" onClick={(e) => handleScrollTo(e, "step2-auth")} className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold font-mono flex items-center justify-center text-xs">2</span>
                <div>
                  <div className="font-bold text-text-primary">Customer Auth Mapping</div>
                  <div className="text-[11px] text-text-secondary">Login Route & JWT Token Path</div>
                </div>
              </a>

              <a href="#step3-catalog" onClick={(e) => handleScrollTo(e, "step3-catalog")} className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold font-mono flex items-center justify-center text-xs">3</span>
                <div>
                  <div className="font-bold text-text-primary">Product Catalog Search</div>
                  <div className="text-[11px] text-text-secondary">Search Endpoint & Keys</div>
                </div>
              </a>

              <a href="#step4-addresses" onClick={(e) => handleScrollTo(e, "step4-addresses")} className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold font-mono flex items-center justify-center text-xs">4</span>
                <div>
                  <div className="font-bold text-text-primary">Saved Addresses</div>
                  <div className="text-[11px] text-text-secondary">Fetch & Optional Creation</div>
                </div>
              </a>

              <a href="#step5-checkout" onClick={(e) => handleScrollTo(e, "step5-checkout")} className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold font-mono flex items-center justify-center text-xs">5</span>
                <div>
                  <div className="font-bold text-text-primary">Order Creation Route</div>
                  <div className="text-[11px] text-text-secondary">Cart Payload & Address ID</div>
                </div>
              </a>

              <a href="#step6-webhook" onClick={(e) => handleScrollTo(e, "step6-webhook")} className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold font-mono flex items-center justify-center text-xs">6</span>
                <div>
                  <div className="font-bold text-text-primary">Webhook Path</div>
                  <div className="text-[11px] text-text-secondary">order.payment_completed</div>
                </div>
              </a>

              <a href="#step7-apikeys" onClick={(e) => handleScrollTo(e, "step7-apikeys")} className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold font-mono flex items-center justify-center text-xs">7</span>
                <div>
                  <div className="font-bold text-text-primary">API Key & Verification</div>
                  <div className="text-[11px] text-text-secondary">sk_live_... & /orders/verify</div>
                </div>
              </a>
            </div>
          </div>

          <hr className="my-10 border-border" />

          {/* Step 1: Base URL */}
          <section id="step1-baseurl" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                1
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Step 1. Store Base URL Setup</h2>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Your Store Base URL is the HTTPS root where your e-commerce APIs are hosted (e.g. <code>https://api.yourstore.com</code> or <code>https://backend.myshop.in</code>).
            </p>
            <div className="p-4 rounded-xl border border-border bg-surface font-mono text-xs space-y-1">
              <div className="text-text-secondary font-bold uppercase">Configured Base URL:</div>
              <div className="text-primary font-semibold">{cleanBaseUrl}</div>
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* Step 2: Auth Mapping */}
          <section id="step2-auth" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                2
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Step 2. Customer Auth Mapping</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              When a customer logs into the ShopAgent widget, ShopAgent forwards their email and password to your authentication route.
            </p>

            <CodeBlock label={`LOGIN REQUEST: POST ${cleanBaseUrl}/api/auth/login`}>
              {`POST ${cleanBaseUrl}/api/auth/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "customer_password"
}`}
            </CodeBlock>

            <p className="text-sm text-text-secondary leading-relaxed">
              Your server responds with a token inside the specified JSON path (e.g. <code>data.token</code> or <code>token</code>):
            </p>

            <CodeBlock label="EXPECTED LOGIN RESPONSE">
              {`{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}`}
            </CodeBlock>

            <p className="text-sm text-text-secondary leading-relaxed">
              On all subsequent authenticated calls (fetching addresses, order creation), ShopAgent includes this token in the header:
            </p>
            <div className="p-3 rounded-xl border border-border bg-surface font-mono text-xs text-text-primary">
              Authorization: Bearer &lt;customer_jwt_token&gt;
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* Step 3: Product Catalog */}
          <section id="step3-catalog" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                3
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Step 3. Product Catalog Search</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              When a user asks the AI agent for items (e.g. <em>"Show me running shoes under ₹3000"</em>), ShopAgent invokes your product search route.
            </p>

            <CodeBlock label={`SEARCH DISPATCH: GET ${cleanBaseUrl}/api/products?query=running+shoes`}>
              {`GET ${cleanBaseUrl}/api/products?query=running+shoes
Accept: application/json`}
            </CodeBlock>

            <CodeBlock label="EXPECTED CATALOG RESPONSE">
              {`{
  "products": [
    {
      "id": "prod_101",
      "name": "Air Cushion Running Shoes",
      "description": "Lightweight breathable mesh upper with responsive shock absorption.",
      "price": 2499.00,
      "thumbnailUrl": "https://cdn.yourstore.com/images/shoes101.jpg"
    }
  ]
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* Step 4: Addresses */}
          <section id="step4-addresses" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                4
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Step 4. Delivery Addresses</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Before placing an order, ShopAgent fetches the customer's saved delivery addresses so the user can select where to ship their order.
            </p>

            <CodeBlock label={`FETCH ADDRESSES: GET ${cleanBaseUrl}/api/customer/addresses`}>
              {`GET ${cleanBaseUrl}/api/customer/addresses
Authorization: Bearer <customer_jwt_token>`}
            </CodeBlock>

            <CodeBlock label="EXPECTED ADDRESSES RESPONSE">
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

          {/* Step 5: Order Creation */}
          <section id="step5-checkout" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                5
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Step 5. Order Creation Route</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              When the user confirms checkout in chat, ShopAgent sends a checkout payload containing cart items and the selected address ID to your order creation endpoint.
            </p>

            <CodeBlock label={`CREATE ORDER: POST ${cleanBaseUrl}/api/orders`}>
              {`POST ${cleanBaseUrl}/api/orders
Authorization: Bearer <customer_jwt_token>
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

            <CodeBlock label="EXPECTED ORDER RESPONSE">
              {`{
  "merchant_order_id": "ORD99823",
  "order_total": 2499.00,
  "currency": "INR",
  "status": "pending_payment"
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* Step 6: Webhook */}
          <section id="step6-webhook" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                6
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Step 6. Webhook Configuration</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Provide a public HTTPS route on your servers. When Razorpay payment capture completes, ShopAgent dispatches the <code>order.payment_completed</code> webhook:
            </p>

            <CodeBlock label={`WEBHOOK DISPATCH: POST ${cleanWebhookUrl}`}>
              {`POST ${cleanWebhookUrl}
Content-Type: application/json

{
  "event": "order.payment_completed",
  "event_id": "evt_9a8b7c6d5e",
  "merchant_order_id": "ORD99823"
}`}
            </CodeBlock>

            <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-warning">Security Golden Rule</h5>
                <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
                  Treat the webhook as an <strong>unauthenticated trigger</strong>. On receipt, return <code>200 OK</code> immediately, then call <strong>Verify Order</strong> to fetch authoritative status.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* Step 7: API Key */}
          <section id="step7-apikeys" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                7
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Step 7. API Keys & S2S Verification</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Generate an API key in your ShopAgent Dashboard (e.g. <code>sk_live_...</code>). Use this key as a Bearer token when calling the Server-to-Server Verification endpoint:
            </p>

            <CodeBlock label="VERIFY ORDER ENDPOINT: GET /merchant/orders/verify?merchant_order_id=ORD99823">
              {`GET https://api.shopagent.dev/merchant/orders/verify?merchant_order_id=ORD99823
Authorization: Bearer sk_live_8f3a9b2c...`}
            </CodeBlock>

            <CodeBlock label="VERIFY ORDER RESPONSE">
              {`{
  "payment": {
    "status": "captured",
    "razorpay_payment_id": "pay_QwErTy12345"
  },
  "data": {
    "order": {
      "order_total": 2499.0
    }
  }
}`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* Key Mappings Matrix */}
          <section id="key-mappings" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                <Database className="w-4 h-4" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Key Mappings & Candidate Table</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              ShopAgent automatically scans product and address item dictionaries for standard field names. If your backend uses custom field names, use the key mapping options during onboarding or return any of the supported candidate keys:
            </p>

            {/* Products Candidate Table */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary mt-6 mb-2">Product Catalog Candidate Keys</h4>
            <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-background text-text-primary font-semibold">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Normalized Property</th>
                    <th className="px-4 py-3 font-semibold">Supported Backend Candidate Keys</th>
                    <th className="px-4 py-3 font-semibold">Fallback Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-text-secondary">
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">id</td>
                    <td className="px-4 py-3 font-mono">id, _id, product_id, itemId, item_id</td>
                    <td className="px-4 py-3 text-error font-medium">Required (Item skipped if missing)</td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">name</td>
                    <td className="px-4 py-3 font-mono">name, title, itemName, item_name, product_name, productName</td>
                    <td className="px-4 py-3 text-error font-medium">Required (Item skipped if missing)</td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">description</td>
                    <td className="px-4 py-3 font-mono">description, desc, summary, itemDescription, details</td>
                    <td className="px-4 py-3">Falls back to empty string <code>""</code></td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">price</td>
                    <td className="px-4 py-3 font-mono">price, unit_price, amount, cost, mrp, final_price</td>
                    <td className="px-4 py-3">Falls back to <code>0.0</code></td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">thumbnailUrl</td>
                    <td className="px-4 py-3 font-mono">thumbnail, thumbnailUrl, image, imageUrl, image_url, photo, banner</td>
                    <td className="px-4 py-3">Falls back to placeholder image</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Addresses Candidate Table */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary mt-8 mb-2">Delivery Address Candidate Keys</h4>
            <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-background text-text-primary font-semibold">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Address Concept</th>
                    <th className="px-4 py-3 font-semibold">Supported Backend Candidate Keys</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-text-secondary">
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">flat_no</td>
                    <td className="px-4 py-3 font-mono">flatNo, flat_no, houseNo, house_no, line1</td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">street</td>
                    <td className="px-4 py-3 font-mono">street, address_line1, line2</td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">city</td>
                    <td className="px-4 py-3 font-mono">city</td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">district</td>
                    <td className="px-4 py-3 font-mono">district</td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">state</td>
                    <td className="px-4 py-3 font-mono">state</td>
                  </tr>
                  <tr className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-bold">pincode</td>
                    <td className="px-4 py-3 font-mono">pincode, zip, postal_code</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* Troubleshooting FAQ */}
          <section id="troubleshooting" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Troubleshooting FAQ</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
                <h4 className="text-xs font-bold text-text-primary">Q: Why are my products not appearing in search?</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Verify that your product JSON response contains an array under the configured key (e.g. <code>products</code> or <code>data</code>) and that each item contains valid <code>id</code> and <code>name</code> keys.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
                <h4 className="text-xs font-bold text-text-primary">Q: Can I test webhooks on localhost?</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  For local testing, use a public tunnel utility like <code>ngrok</code> (e.g. <code>ngrok http 8000</code>) to expose your local webhook path as an HTTPS URL.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
                <h4 className="text-xs font-bold text-text-primary">Q: What happens if an address creation fails?</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Address creation is optional. If your store does not support agent address creation, ShopAgent will prompt the customer to choose from existing saved addresses or add one on your store's website.
                </p>
              </div>
            </div>
          </section>
        </article>
      </div>

      {/* Right Column: Sticky Table of Contents Sidebar (Desktop only) */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 font-sans">
        <div className="border-l border-border pl-5 space-y-4">
          <h3 className="font-heading font-bold text-xs text-text-primary uppercase tracking-wider">
            On this page
          </h3>
          <nav className="flex flex-col space-y-2">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                onClick={(e) => handleScrollTo(e, heading.id)}
                className={`text-xs font-medium transition-all duration-200 flex items-center gap-2 group py-0.5 ${activeId === heading.id
                  ? "text-primary pl-1 font-semibold"
                  : "text-text-secondary hover:text-text-primary"
                  }`}
              >
                <ChevronRight
                  className={`w-3 h-3 text-primary shrink-0 transition-all duration-200 ${activeId === heading.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
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
