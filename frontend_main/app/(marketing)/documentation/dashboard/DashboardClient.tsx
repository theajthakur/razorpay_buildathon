"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Settings, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Menu,
  Sliders,
  ShieldAlert,
  Info,
  Play,
  Pause,
  Trash2
} from "lucide-react";

interface HeadingItem {
  id: string;
  text: string;
}

export default function DashboardClient() {
  const [activeId, setActiveId] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Headings for scroll-spy nav
  const headings: HeadingItem[] = [
    { id: "overview", text: "Overview" },
    { id: "agent-settings", text: "Agent Settings" },
    { id: "capabilities", text: "Capabilities & Behaviors" },
    { id: "security-limits", text: "Payment Security Limits" },
    { id: "api-keys", text: "API Keys Management" },
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
      {/* Mobile Anchor Navigation Drawer Toggle */}
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
                  className={`block text-sm font-medium py-1.5 px-2.5 rounded-lg border-l-2 transition-all ${
                    activeId === heading.id
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
          
          <h1 id="overview" className="font-heading text-4xl font-extrabold text-text-primary tracking-tight mb-4 scroll-mt-24">
            Dashboard Reference Guides
          </h1>
          <p className="text-base text-text-secondary leading-relaxed mb-8">
            This guide covers how to customize your AI shopping assistant's identity, manage behavior toggles, set checkout limits, and provision API Keys.
          </p>

          <hr className="my-8 border-border" />

          {/* Agent Settings Section */}
          <section id="agent-settings" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Agent Settings (`/settings`)</h2>
            </div>
            
            <p className="text-sm text-text-secondary leading-relaxed">
              Configure parameters related to the agent's identity, appearance, capabilities, and checkout thresholds.
            </p>

            <div className="space-y-4">
              <h3 className="text-base font-bold text-text-primary font-heading">Domain Assignment Status</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Exposes the subdomain or custom domain your storefront chat widget is deployed on. The green check banner verifies that routing is active and that customers can access your hosted chat window successfully.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-bold text-text-primary font-heading">General Settings — Agent Assistant Name</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                The name the agent introduces itself with to customers in chat (e.g. <em>"Hello! I am Aria, your personal shopping assistant..."</em>). This is cosmetic and purely conversational—changing the name will not impact any underlying catalog search API endpoints or webhook logic.
              </p>
            </div>
          </section>

          <hr className="my-8 border-border" />

          {/* Capabilities & Behavior Section */}
          <section id="capabilities" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Capabilities & Behavior</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Merchants can toggle specific assistant behaviors on or off. Note that some options are roadmap items that are not yet active in our model logic.
            </p>

            <div className="space-y-5">
              {/* History Lookup */}
              <div className="p-5 rounded-xl border border-border bg-surface/50 flex gap-4">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-primary m-0">Order History Lookup</h4>
                    <span className="px-1.5 py-0.5 bg-success/10 text-success rounded text-[9px] font-bold uppercase select-none">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    When enabled, the assistant queries your Order History endpoint in real-time to answer status questions. Requires a properly configured order endpoint—enabling this toggle without a connected endpoint will cause the agent to politely inform the user that history lookups are currently unavailable.
                  </p>
                </div>
              </div>

              {/* Cart Negotiation */}
              <div className="p-5 rounded-xl border border-border bg-surface/50 flex gap-4">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-primary m-0">Cart Price Negotiation</h4>
                    <span className="px-1.5 py-0.5 bg-warning/15 text-warning rounded text-[9px] font-bold uppercase select-none">
                      Roadmap Only
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Designed to allow the AI to offer slight discount incentives in response to cart abandonment. <strong>Currently inactive</strong>—changing this setting has no effect on model conversations, as negotiation logic is not yet deployed in the agentic LLM loops.
                  </p>
                </div>
              </div>

              {/* Auto Coupons */}
              <div className="p-5 rounded-xl border border-border bg-surface/50 flex gap-4">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-primary m-0">Auto-Apply Coupon Codes</h4>
                    <span className="px-1.5 py-0.5 bg-warning/15 text-warning rounded text-[9px] font-bold uppercase select-none">
                      Roadmap Only
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Designed to let the assistant dynamically query and auto-apply coupon code values during purchase confirmation. <strong>Currently inactive</strong>—the coupon checkout field remains mock-only, and no discount computations are live yet.
                  </p>
                </div>
              </div>

              {/* Smart Upsell */}
              <div className="p-5 rounded-xl border border-border bg-surface/50 flex gap-4">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-primary m-0">Smart Catalog Upsell</h4>
                    <span className="px-1.5 py-0.5 bg-warning/15 text-warning rounded text-[9px] font-bold uppercase select-none">
                      Roadmap Only
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Designed to suggest complementary products from your catalog (e.g. recommending items based on customer selections). <strong>Currently inactive</strong>—the LLM restricts responses strictly to search query results.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <hr className="my-8 border-border" />

          {/* Payment Security Limits Section */}
          <section id="security-limits" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">Payment Security Limits</h2>
            </div>

            <h3 className="text-base font-bold text-text-primary font-heading">Human Confirmation Threshold (INR)</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              To enforce bounded autonomy, any payment or purchase checkout link above this set value requires manual merchant sign-off from the dashboard before it is delivered to the shopper. Orders below this threshold are completed autonomously by the agent.
            </p>

            <div className="p-4 rounded-xl border border-warning/20 bg-warning/5 flex items-start gap-3">
              <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-warning">Roadmap Status Check</h5>
                <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
                  Threshold limits are successfully stored in your dashboard configurations, but enforcement logic is currently a <strong>roadmap item</strong>—all cart payments in the widget currently complete automatically regardless of the limit.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-border" />

          {/* API Keys Section */}
          <section id="api-keys" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">API Keys Management (`/settings/api-keys`)</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              API Keys allow your custom e-commerce storefront applications to query ShopAgent's services directly. This is the reverse of onboarding mappings (where we call you)—these keys authorize your servers to make direct request queries to us.
            </p>

            {/* State Table Columns */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-text-primary font-heading">Key Parameters & Properties</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-xs text-text-secondary">
                  <thead>
                    <tr className="bg-background">
                      <th className="px-4 py-2 text-left font-bold text-text-primary">Column</th>
                      <th className="px-4 py-2 text-left font-bold text-text-primary">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-2.5 font-bold font-mono">Name</td>
                      <td className="px-4 py-2.5 leading-relaxed">A custom, unique description label chosen by you to identify the integration (e.g. "React Web Store").</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold font-mono">API Key</td>
                      <td className="px-4 py-2.5 leading-relaxed">The masked token (e.g. <code>sk_live_v2a7••••••••</code>). The full key is displayed **only once** immediately upon creation. Copy and store it securely immediately.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold font-mono">Status</td>
                      <td className="px-4 py-2.5 leading-relaxed">Shows the key's state: <strong>Active</strong> (authenticating normally) or <strong>Paused</strong> (temporarily disabled).</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold font-mono">Last Used</td>
                      <td className="px-4 py-2.5 leading-relaxed">Relative time indicating when the key was last used to make an API call, or "Never used".</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active vs Paused vs Revoke */}
            <div className="space-y-4 mt-6">
              <h3 className="text-base font-bold text-text-primary font-heading">Key Actions: Pause vs. Revoke</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl border border-border bg-surface flex gap-3.5">
                  <Pause className="w-5 h-5 text-warning shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-text-primary m-0">Pause / Resume Key</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      A **temporary, reversible** disable. Requests using a paused key are instantly rejected with HTTP 401. However, the key record and its slot are preserved. Resuming the key restores authorization instantly.
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-border bg-surface flex gap-3.5">
                  <Trash2 className="w-5 h-5 text-error shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-text-primary m-0">Revoke Key</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      A **permanent, destructive** deletion. A revoked key immediately ceases to work and is hard-deleted from our databases. This action is irreversible.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5-Key Slot limits */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 mt-6">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-primary">The 5-Key Slot Limit</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    You can generate a maximum of <strong>5 API keys</strong>. Both active and paused keys occupy slots. Pausing a key does NOT free a slot. To create a new key when at the limit, you must **revoke** (permanently delete) an existing key first.
                  </p>
                </div>
              </div>
            </div>
          </section>

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
