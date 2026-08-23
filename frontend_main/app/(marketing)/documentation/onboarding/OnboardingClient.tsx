"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, ShieldCheck, AlertCircle, Copy, Check, ChevronRight, Menu } from "lucide-react";

interface HeadingItem {
  id: string;
  text: string;
}

// Custom Code Block component with copy button
function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = children.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 group rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border text-xs text-text-secondary font-mono">
        <span>SCRIPT SNIPPET</span>
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
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

export default function OnboardingClient() {
  const [activeId, setActiveId] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Headings for scroll-spy nav
  const headings: HeadingItem[] = [
    { id: "overview", text: "Overview" },
    { id: "prerequisites", text: "Prerequisites" },
    { id: "step-by-step-flow", text: "Step-by-Step Flow" },
    { id: "merchant-responsibilities", text: "Merchant Responsibilities" },
    { id: "shopagent-handles", text: "What ShopAgent Handles" },
    { id: "common-issues", text: "Troubleshooting FAQ" },
    { id: "next-steps", text: "Next Steps" },
  ];

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
    <>
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
        <article className="prose max-w-none">
          
          {/* Welcome / Overview */}
          <h1 id="overview" className="font-heading text-4xl font-extrabold text-text-primary tracking-tight mb-6 scroll-mt-24">
            Merchant Onboarding Guide
          </h1>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            By the end of this guide, your store will be connected to ShopAgent, your webhook will be receiving payment events, and your AI agent will be live for customers.
          </p>

          <hr className="my-10 border-border" />

          {/* Prerequisites */}
          <h2 id="prerequisites" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-6 pb-2 border-b border-border scroll-mt-24">
            Prerequisites
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            Ensure you have these technical items set up before initiating your ShopAgent connection:
          </p>
          <div className="space-y-4 mb-10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-base text-text-secondary leading-relaxed">
                An existing e-commerce store with a reachable backend (any stack like Node, Python, PHP, or Go).
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-base text-text-secondary leading-relaxed">
                A product catalog with a stable <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">product_id</code>, name, price, and stock quantities available via an API endpoint you control.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-base text-text-secondary leading-relaxed">
                An order-creation flow you're willing to let ShopAgent call on your customers' behalf (note that no modification to your existing storefront checkout logic is required).
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-base text-text-secondary leading-relaxed">
                A publicly reachable HTTPS endpoint on your servers that you can register as your webhook URL.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-base text-text-secondary leading-relaxed">
                Ability to add environment variables or secure secrets to your store's backend environment (for storing the API authorization key).
              </span>
            </div>
          </div>

          <hr className="my-10 border-border" />

          {/* Step-by-Step Flow (Vertical Stepper Layout) */}
          <h2 id="step-by-step-flow" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-8 pb-2 border-b border-border scroll-mt-24">
            Step-by-Step Flow
          </h2>
          
          <div className="relative border-l-2 border-border ml-4 pl-8 space-y-12 mb-10">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                1
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Create a ShopAgent account</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans">
                Sign up via the dashboard, complete your storefront's profile, and specify basic business parameters.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                2
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Get your API key</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans mb-3">
                Your API key is generated immediately after profile creation. This credentials key authenticates all incoming query calls from your shop to ShopAgent using:
              </p>
              <code className="block p-3 rounded-lg bg-background border border-border text-primary font-mono text-sm font-semibold mb-3">
                Authorization: Bearer &lt;YOUR_API_KEY&gt;
              </code>
              <p className="text-sm text-text-secondary italic font-sans">
                Security Reminder: Store this API key strictly server-side. Never expose it in client-side code or git repositories.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                3
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Connect your store APIs</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans">
                Enter your connection base URL coordinates and map parameters for customer login lookup, product query searches, order history details, and shipping address creation. ShopAgent uses your backend databases as the single source of truth for pricing and product inventory — it never accepts pricing parameters from other client checkouts to prevent tampering.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                4
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Register your webhook URL</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans">
                Provide your HTTPS webhook routing endpoint in the ShopAgent dashboard. This route listens for incoming <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">order.payment_completed</code> payloads dispatched on successful checkout. Check the API Reference page for the detailed payload contract and fields.
              </p>
            </div>

            {/* Step 5 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                5
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Handle the webhook + verify</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans">
                When a checkout webhook fires, always trigger a secondary server-to-server check calling the Verify Order API to fetch authenticated status details directly from Razorpay. Fulfill your orders only when the verification check returns a <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">captured</code> status value.
              </p>
            </div>

            {/* Step 6 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                6
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Test in sandbox mode</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans">
                Enable Sandbox Mode inside the developer portal. Use the sandbox testing credentials and test API key to simulate purchase checkout attempts through the chat widget, confirming that the webhook notifies your server and resolves successfully before deploying live checkout boundaries.
              </p>
            </div>

            {/* Step 7 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                7
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Embed the agent on your storefront</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans">
                Add the shopper chat widget directly to your website. Copy and paste this script snippet right before your storefront page's closing <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">&lt;/body&gt;</code> element:
              </p>
              <CodeBlock>
{`<script 
  src="https://cdn.shopagent.dev/widget.js" 
  data-store-id="YOUR_STORE_ID" 
  async
></script>`}
              </CodeBlock>
            </div>

            {/* Step 8 */}
            <div className="relative">
              <div className="absolute -left-12 top-0.5 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-text-on-primary font-heading font-bold text-sm shadow-sm">
                8
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 font-heading">Go live</h3>
              <p className="text-base text-text-secondary leading-relaxed font-sans">
                Replace your backend test credentials with live production secrets, set your webhook target coordinates to production URL points, and execute a live purchase checklist lookup to ensure settlement flows are operating correctly.
              </p>
            </div>
          </div>

          <hr className="my-10 border-border" />

          {/* What ShopAgent Needs (Merchant Responsibilities) */}
          <h2 id="merchant-responsibilities" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-6 pb-2 border-b border-border scroll-mt-24">
            Merchant Responsibilities
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            To ensure ongoing security and flawless operation of the shopping assistant, merchants are responsible for the following tasks:
          </p>
          <div className="space-y-4 mb-10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-text-primary">Accurate Product and Pricing Feeds</p>
                <p className="text-sm text-text-secondary leading-relaxed mt-1">
                  Keep product search and pricing details updated via your product API. The AI agent queries your endpoints in real-time and does not cache pricing decisions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-text-primary">Webhook Availability</p>
                <p className="text-sm text-text-secondary leading-relaxed mt-1">
                  Keep your webhook receiver endpoint available and responding with <code className="px-1.5 py-0.5 rounded-md bg-background border border-border text-primary font-mono text-xs font-semibold">2xx</code> status codes. If your server is down, delivery retries will stop after exponential backoffs, requiring you to manually trigger Verify Order checks to synchronize missed transactions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-text-primary">API Key Management</p>
                <p className="text-sm text-text-secondary leading-relaxed mt-1">
                  Promptly rotate your credentials inside the ShopAgent developer dashboard if your API key is ever exposed or leaked.
                </p>
              </div>
            </div>
          </div>

          <hr className="my-10 border-border" />

          {/* What ShopAgent Handles */}
          <h2 id="shopagent-handles" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-6 pb-2 border-b border-border scroll-mt-24">
            What ShopAgent Handles
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            ShopAgent manages these core services automatically so you don't have to build them:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="p-5 rounded-xl border border-border bg-surface flex gap-3">
              <ShieldCheck className="w-6 h-6 text-success shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-text-primary">Conversational Searches</h4>
                <p className="text-xs text-text-secondary mt-1">
                  Processes search matches, attributes filters, and product comparison lists over your catalog.
                </p>
              </div>
            </div>
            <div className="p-5 rounded-xl border border-border bg-surface flex gap-3">
              <ShieldCheck className="w-6 h-6 text-success shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-text-primary">Order Tracking Lookups</h4>
                <p className="text-xs text-text-secondary mt-1">
                  Securely validates customer credentials and fetches shipment states.
                </p>
              </div>
            </div>
            <div className="p-5 rounded-xl border border-border bg-surface flex gap-3">
              <ShieldCheck className="w-6 h-6 text-success shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-text-primary">Secure Payment Collection</h4>
                <p className="text-xs text-text-secondary mt-1">
                  Collects funds, reserves authorizations, and relays payment capture states.
                </p>
              </div>
            </div>
            <div className="p-5 rounded-xl border border-border bg-surface flex gap-3">
              <ShieldCheck className="w-6 h-6 text-success shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-text-primary">Webhook Delivery Retries</h4>
                <p className="text-xs text-text-secondary mt-1">
                  Guarantees message delivery using exponential retry backoff intervals.
                </p>
              </div>
            </div>
          </div>

          <hr className="my-10 border-border" />

          {/* Troubleshooting Section */}
          <h2 id="common-issues" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-6 pb-2 border-b border-border scroll-mt-24">
            Common Onboarding Issues
          </h2>
          <div className="space-y-4 mb-10">
            <div className="p-6 rounded-xl border border-border bg-surface/50 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-text-primary">Webhook endpoint is not receiving events</p>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Verify that your URL is publicly accessible over HTTPS (self-signed SSL certificates are rejected) and that your firewall is configured to allow incoming traffic from ShopAgent servers.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-text-primary">Verify Order request fails with a 401 Unauthorized status</p>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Confirm that your ShopAgent API Key is correctly set in your backend config and matches the value provided in the header: <code className="px-1 py-0.5 bg-background border border-border rounded font-mono text-[11px] text-primary">Authorization: Bearer &lt;YOUR_API_KEY&gt;</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-text-primary">Orders are stuck in a pending payment status</p>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Check the webhook delivery logs inside your dashboard to locate failing response codes, or execute a manual Verify Order call directly on the order to synchronize its state without waiting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <hr className="my-10 border-border" />

          {/* Next Steps */}
          <h2 id="next-steps" className="font-heading text-2xl font-bold text-text-primary mt-12 mb-4 pb-2 border-b border-border scroll-mt-24">
            Next Steps
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mb-6 font-sans">
            To view detailed JSON request payloads, status response contracts, and endpoint parameters, navigate to the API Reference. If you require custom integration assistance or have setup queries, please contact our developer support team.
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
    </>
  );
}
