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
  Building2
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
    if (target.includes("ponion")) {
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

  // Merge loaded onboarding configuration with default templates for rendering fallback
  const isSetupCompleted = !!onboarding;
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

  const cleanBaseUrl = merged.base_url && !merged.base_url.includes("ponion")
    ? merged.base_url.replace(/\/$/, "")
    : "https://example.com";

  const cleanWebhookUrl = formatEndpointUrl(cleanBaseUrl, merged.webhook_url);

  // Headings for scroll-spy nav
  const headings: HeadingItem[] = [
    { id: "overview", text: "Overview & Prerequisites" },
    { id: "auth", text: "1. Authentication Mapping" },
    { id: "branding", text: "2. Branding & Webhooks" },
    { id: "resources", text: "3. Resource Endpoints" },
    { id: "settlement", text: "4. Settlement Payouts" },
    { id: "troubleshooting", text: "5. Troubleshooting FAQ" },
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

  return (
    <>
      {/* Mobile Anchor Navigation Drawer Overlay */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer"
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
                    ? "border-primary text-primary bg-primary/5 pl-3.5"
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
      <div className="flex-1 max-w-full lg:max-w-[72ch] min-w-0 font-sans">
        <article className="prose max-w-none">

          {/* Welcome / Header */}
          <h1 id="overview" className="font-heading text-4xl font-extrabold text-text-primary tracking-tight mb-4 scroll-mt-24">
            Interactive Onboarding Guide
          </h1>
          <p className="text-base text-text-secondary leading-relaxed mb-6">
            Welcome! This integration handbook details how your specific store interacts with ShopAgent.
          </p>


          {/* Prerequisites */}
          <div className="space-y-4 mb-8">
            <h3 className="font-heading text-xl font-bold text-text-primary">Prerequisites & Scope</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Before setting up, please note that **ShopAgent does not require changing your existing authentication or checkout code**. Our assistant is designed to wrap around your current routes. You are mapping *our platform to your endpoints*, keeping your backend fully intact.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>An e-commerce backend accessible over HTTPS (Node, Python, Go, PHP, etc.).</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Exposed endpoints for search cataloging and transaction history.</span>
              </div>
            </div>
          </div>

          <hr className="my-8 border-border" />

          {/* 1. Authentication */}
          <section id="auth" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">1. Authentication Mapping</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              ShopAgent authenticates your store's users by forwarding their credentials directly to your login route.
            </p>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Customer Login Request</h4>
              <p className="text-xs text-text-secondary">
                When a customer signs into the chat widget, ShopAgent triggers a <strong>{merged.auth_config.method}</strong> call to your Login URL:
              </p>

              <CodeBlock label={`HTTP REQUEST: ${merged.auth_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.auth_config.auth_url)}`}>
                {`
${merged.auth_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.auth_config.auth_url)}
Content-Type: application/json

{
  "${merged.auth_config.identifier_field}": "customer@example.com",
  "${merged.auth_config.password_field}": "password123"
}
`}
              </CodeBlock>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Expected Token Response</h4>
              <p className="text-xs text-text-secondary">
                Your backend must respond with a <strong>2xx status</strong>, containing the customer's session token at the configured token path (<code>{merged.auth_config.token_path}</code>):
              </p>

              <CodeBlock label="JSON RESPONSE EXAMPLE">
                {`
{
  "status": "success",
  "data": {
    "token": "example_encoded_customer_jwt_token_here"
  }
}
`}
              </CodeBlock>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Token Delivery Mechanism</h4>
              <p className="text-xs text-text-secondary font-medium">
                On all subsequent customer requests (e.g. order history, address additions), ShopAgent will attach the extracted session token per your configuration:
              </p>

              {merged.auth_config.token_delivery.method === "cookie" ? (
                <div className="p-3.5 rounded-lg border border-border bg-background font-mono text-xs">
                  Cookie: {merged.auth_config.token_delivery.cookie_name || "token"}=&lt;token&gt;
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-border bg-background font-mono text-xs">
                  {merged.auth_config.token_delivery.header_name || "Authorization"}: {merged.auth_config.token_delivery.bearer_prefix ? "Bearer " : ""}&lt;token&gt;
                </div>
              )}
            </div>
          </section>

          <hr className="my-8 border-border" />

          {/* 2. Branding & Webhooks */}
          <section id="branding" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">2. Branding & Webhooks</h2>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Accents & Store Styling</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The accent color (<code>{merged.branding_config?.brand_color || "#7c3aed"}</code>) and widget logo url shape how the ShopAgent widget blends visually into your storefront wrapper. These parameters have no code integration impact.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Payment Completion Webhook</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Provide an HTTPS endpoint on your servers to receive successful checkout notifications. Whenever a customer completes a card checkout inside the agent chat widget, ShopAgent dispatches a webhook event:
              </p>

              <CodeBlock label={`POST ${cleanWebhookUrl}`}>
                {`
POST ${cleanWebhookUrl}
Content-Type: application/json

{
  "event": "order.payment_completed",
  "event_id": "evt_123abc456def",
  "merchant_order_id": "ord_your_mapped_order_id_here"
}
`}
              </CodeBlock>

              <div className="p-4 rounded-xl border border-info/30 bg-info/5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-info shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-info">Webhook Security Best Practice</h5>
                  <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
                    Never mark an order as paid solely based on the webhook body. Always call our <strong>Verify Order</strong> API to fetch the authenticated payment status directly from Razorpay.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <hr className="my-8 border-border" />

          {/* 3. Resource Endpoints */}
          <section id="resources" className="scroll-mt-24 space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">3. Resource Endpoints</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              ShopAgent utilizes five resource endpoints on your backend as a single source of truth for catalogue queries, order details, and checkouts.
            </p>

            {/* Products Catalog */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <h3 className="text-base font-bold text-text-primary font-heading m-0">A. Products Catalog Search</h3>
                <span className="px-2 py-0.5 bg-success-light text-success border border-success/20 rounded-md text-[10px] font-bold uppercase select-none">
                  Search Endpoint
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Allows the agent to search your product catalogue by user search terms.
              </p>
              <CodeBlock label={`HTTP REQUEST: ${merged.products_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.products_config.path)}?${merged.products_config.payload_key}=shoes`}>
                {`
${merged.products_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.products_config.path)}?${merged.products_config.payload_key}=shoes
`}
              </CodeBlock>
              <p className="text-xs text-text-secondary">
                Expected JSON response matching your configured key (<code>{merged.products_config.response_key}</code>):
              </p>
              <CodeBlock label="JSON RESPONSE EXAMPLE">
                {`
{
  "${merged.products_config.response_key}": [
    {
      "id": "prod_shoes_99",
      "name": "Classic Sneakers",
      "description": "Premium leather sneakers.",
      "price": 2499.00,
      "thumbnailUrl": "https://img.yourstore.com/sneakers.jpg"
    }
  ]
}
`}
              </CodeBlock>

              <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-warning">Per-Field Catalog Normalization Limit</h5>
                  <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5 font-sans">
                    Please note that ShopAgent does not support individual key mapping for catalog properties (id, name, price, description, and thumbnail). Products returned by your endpoint should use standard keys like <code>id</code>/<code>_id</code>, <code>name</code>/<code>title</code>/<code>itemName</code>, <code>price</code>, <code>description</code>, and <code>thumbnail</code>/<code>thumbnailUrl</code> to ensure they are parsed successfully by our normalizer.
                  </p>
                </div>
              </div>
            </div>

            {/* Order History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <h3 className="text-base font-bold text-text-primary font-heading m-0">B. Order History</h3>
                <span className="px-2 py-0.5 bg-surface-300 text-text-secondary border border-border rounded-md text-[10px] font-bold uppercase select-none">
                  Authenticated
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Fetches a customer's purchase logs. Calls your endpoint carrying their authenticated session token:
              </p>
              <CodeBlock label={`HTTP REQUEST: ${merged.order_history_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.order_history_config.path)}`}>
                {`
${merged.order_history_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.order_history_config.path)}
`}
              </CodeBlock>
              <p className="text-xs text-text-secondary">
                Expected response format matching key (<code>{merged.order_history_config.response_key}</code>):
              </p>
              <CodeBlock label="JSON RESPONSE EXAMPLE">
                {`
{
  "${merged.order_history_config.response_key}": [
    {
      "order_id": "ord_10023",
      "status": "shipped",
      "total_price": 4998.00,
      "created_at": "2026-08-30T00:23:46Z"
    }
  ]
}
`}
              </CodeBlock>
            </div>

            {/* Customer Profile */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <h3 className="text-base font-bold text-text-primary font-heading m-0">C. Customer Profile</h3>
                <span className="px-2 py-0.5 bg-surface-300 text-text-secondary border border-border rounded-md text-[10px] font-bold uppercase select-none">
                  Authenticated
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Fetches profile details to help personalize conversational greetings.
              </p>
              <CodeBlock label={`HTTP REQUEST: ${merged.customer_profile_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.customer_profile_config.path)}`}>
                {`
${merged.customer_profile_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.customer_profile_config.path)}
`}
              </CodeBlock>
            </div>

            {/* Customer Addresses */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <h3 className="text-base font-bold text-text-primary font-heading m-0">D. Customer Addresses</h3>
                <span className="px-2 py-0.5 bg-surface-300 text-text-secondary border border-border rounded-md text-[10px] font-bold uppercase select-none">
                  Authenticated
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Fetches and creates shipping addresses.
              </p>

              <div className="space-y-3">
                <p className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Retrieve Addresses</p>
                <CodeBlock label={`HTTP REQUEST: ${(merged.addresses_config as any).fetch?.method || (merged.addresses_config as any).fetch_method || "GET"} ${formatEndpointUrl(cleanBaseUrl, (merged.addresses_config as any).fetch?.path || (merged.addresses_config as any).fetch_path || "/api/customer/addresses")}`}>
                  {`
${(merged.addresses_config as any).fetch?.method || (merged.addresses_config as any).fetch_method || "GET"} ${formatEndpointUrl(cleanBaseUrl, (merged.addresses_config as any).fetch?.path || (merged.addresses_config as any).fetch_path || "/api/customer/addresses")}
`}
                </CodeBlock>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Create Shipping Address</p>
                <p className="text-xs text-text-secondary">
                  ShopAgent posts the address data using your mapped fields:
                </p>
                <CodeBlock label={`HTTP REQUEST: ${(merged.addresses_config as any).create?.method || (merged.addresses_config as any).create_method || "POST"} ${formatEndpointUrl(cleanBaseUrl, (merged.addresses_config as any).create?.path || (merged.addresses_config as any).create_path || "/api/customer/addresses")}`}>
                  {`
${(merged.addresses_config as any).create?.method || (merged.addresses_config as any).create_method || "POST"} ${formatEndpointUrl(cleanBaseUrl, (merged.addresses_config as any).create?.path || (merged.addresses_config as any).create_path || "/api/customer/addresses")}
Content-Type: application/json

{
  "line1": "Flat 402, Sector 12",
  "line2": "Huda Colony",
  "city": "Gurugram",
  "state": "Haryana",
  "pincode": "122001"
}
`}
                </CodeBlock>
              </div>
            </div>

            {/* Create Order */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <h3 className="text-base font-bold text-text-primary font-heading m-0">E. Create Order</h3>
                <span className="px-2 py-0.5 bg-success-light text-success border border-success/20 rounded-md text-[10px] font-bold uppercase select-none">
                  Checkout Route
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Exposes the order-generation flow. When a customer confirms checkout in the widget, ShopAgent sends a payload containing cart items mapping your keys:
              </p>

              <CodeBlock label={`HTTP REQUEST: ${merged.create_order_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.create_order_config.path)}`}>
                {`
${merged.create_order_config.method} ${formatEndpointUrl(cleanBaseUrl, merged.create_order_config.path)}
Content-Type: application/json

{
  "${merged.create_order_config.cart_key}": [
    {
      "${merged.create_order_config.item_id_field}": "prod_shoes_99",
      "${merged.create_order_config.price_field}": 2499.00,
      "${merged.create_order_config.quantity_field}": 2
    }
  ],
  "${merged.create_order_config.address_id_field || "address_id"}": "addr_99812",
  "source": "shopagent"
}
`}
              </CodeBlock>
            </div>

            <p className="text-sm font-semibold text-text-primary leading-relaxed mt-4">
              💡 The accuracy of these 5 endpoints directly dictates how intelligent and helpful your shopping assistant is. Better feeds translate directly to a better customer checkout experience!
            </p>
          </section>

          <hr className="my-8 border-border" />

          {/* 4. Settlement Bank Account */}
          <section id="settlement" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">4. Settlement Payouts</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Payout settlement is handled entirely off-line and separate from the API routing layer. <strong>No code changes are required for this section</strong>.
            </p>

            <div className="p-5 rounded-xl border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Settlement Routing</p>
                <div className="text-sm text-text-primary font-medium">
                  {onboarding?.bank_account ? (
                    <span className="font-mono text-xs">Bank A/C: {onboarding.bank_account.slice(-4).padStart(onboarding.bank_account.length, "•")}</span>
                  ) : (
                    <span>No bank account registered yet.</span>
                  )}
                </div>
                {onboarding?.ifsc && (
                  <div className="text-xs text-text-secondary leading-relaxed">
                    IFSC: <span className="font-mono">{onboarding.ifsc}</span>
                    {onboarding.branch_name && <span> — {onboarding.branch_name}</span>}
                  </div>
                )}
              </div>
              {onboarding?.bank_account && onboarding?.ifsc ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 border border-success/20 text-success text-xs font-semibold select-none self-start md:self-auto">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Route Verified
                </div>
              ) : (
                <span className="text-xs text-text-secondary italic self-start md:self-auto">Pending setup</span>
              )}
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              When checkout checks complete, Razorpay routes payouts to this account. Branch details are validated in real-time using IFSC lookup.
            </p>
          </section>

          <hr className="my-8 border-border" />

          {/* 5. Troubleshooting Section */}
          <section id="troubleshooting" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">5. Troubleshooting FAQ</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              When testing connection, ShopAgent sends standard test query requests to check if your endpoints return HTTP 2xx statuses. Common failures include:
            </p>

            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-border bg-surface/40 space-y-3.5">
                <div>
                  <h4 className="text-xs font-bold text-text-primary">1. Test connection returns "Not Connected"</h4>
                  <p className="text-xs text-text-secondary leading-relaxed mt-1">
                    Confirm that your URL paths do not require session authentication if they are public resource routes (like product searches). If they do require customer auth, ensure your mappings match the credentials format.
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">2. Webhook is not firing on checkout</h4>
                  <p className="text-xs text-text-secondary leading-relaxed mt-1">
                    Make sure the webhook endpoint is exposed to public HTTP traffic. Firewall rules or local ports (like localhost) will block ShopAgent servers. Use tunnels like <code>ngrok</code> to test locally in Sandbox Mode.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Quickstart checklist */}
          <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 mt-10 space-y-4">
            <h3 className="text-base pb-4 font-bold text-text-primary font-heading m-0">Quickstart Integration Checklist</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <div className="w-4.5 h-4.5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">1</div>
                <span>Expose endpoints</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <div className="w-4.5 h-4.5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">2</div>
                <span>Map authentication credentials</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <div className="w-4.5 h-4.5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">3</div>
                <span>Complete the 5 resource mappings</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <div className="w-4.5 h-4.5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">4</div>
                <span>Set webhook & payouts bank info</span>
              </div>
            </div>
          </div>

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
                className={`text-sm font-medium transition-all duration-200 flex items-center gap-2 group py-0.5 ${activeId === heading.id
                  ? "text-primary pl-1 font-semibold"
                  : "text-text-secondary hover:text-text-primary"
                  }`}
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 text-primary shrink-0 transition-all duration-200 ${activeId === heading.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
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
