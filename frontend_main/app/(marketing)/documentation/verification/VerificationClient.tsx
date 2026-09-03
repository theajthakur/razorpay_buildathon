"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Key,
  Copy,
  Check,
  ChevronRight,
  Menu,
  FileCode,
  AlertTriangle,
  Lock,
  Zap,
  RefreshCcw,
  CheckCircle2,
  AlertCircle
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

export default function VerificationClient() {
  const [activeId, setActiveId] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const headings: HeadingItem[] = [
    { id: "overview", text: "Security Overview" },
    { id: "api-keys", text: "1. API Key Architecture" },
    { id: "payment-webhook", text: "2. Webhook: order.payment_completed" },
    { id: "idempotency", text: "3. Webhook Idempotency & Retries" },
    { id: "s2s-verification", text: "4. Server-to-Server Order Verify" },
    { id: "order-lifecycle", text: "5. Order State Machine" },
    { id: "security-best-practices", text: "6. Security Best Practices" },
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
    const markdown = `# API Keys, Payment Webhooks & S2S Verification
API Key Format: sk_live_<24 base64url bytes>
Header: Authorization: Bearer sk_live_...
Webhook Event: order.payment_completed
S2S Verify: GET /merchant/orders/verify?merchant_order_id=ORD1234`;
    navigator.clipboard.writeText(markdown);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <>
      {/* Mobile Menu Drawer Toggle */}
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
              <h3 className="font-heading font-bold text-lg text-text-primary">On This Page</h3>
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
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary">Security & Payment Verification System</h4>
              <p className="text-[11px] text-text-secondary">API keys, webhook triggers, idempotency, and S2S order verification.</p>
            </div>
          </div>
          <button
            onClick={handleCopyMarkdown}
            className={`px-3.5 py-1.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border ${
              copiedRaw ? "bg-success border-success text-text-on-primary" : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover"
            }`}
          >
            {copiedRaw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRaw ? "Copied Security Specs!" : "Copy Security Specs"}</span>
          </button>
        </div>

        <article className="prose max-w-none">
          <h1 id="overview" className="font-heading text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-4 scroll-mt-24">
            API Keys, Webhooks & S2S Payment Verification
          </h1>
          <p className="text-base text-text-secondary leading-relaxed mb-6">
            ShopAgent enforces strict security boundaries between shopping agent interactions, payment processing, and store order fulfillment. This guide explains how API keys authenticate backend calls, how webhooks trigger notifications, and how Server-to-Server (S2S) verification ensures zero payment fraud.
          </p>

          <hr className="my-10 border-border" />

          {/* 1. API Key Architecture */}
          <section id="api-keys" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                1
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">1. API Key Architecture</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              API Keys are generated in your ShopAgent Merchant Dashboard and authenticate your server-to-server calls (such as verifying payment status).
            </p>

            <div className="p-4 rounded-xl border border-border bg-surface font-mono text-xs space-y-2">
              <div className="text-text-secondary font-bold uppercase">Key Format Specification:</div>
              <div className="text-primary font-bold">sk_live_&lt;24_base64url_random_bytes&gt;</div>
              <div className="text-text-secondary text-[11px]">Example: <code>sk_live_q8k3mN9xP2wL5vR8tY1zA4bC</code></div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary mt-4 mb-2">Key Security Properties</h4>
            <div className="space-y-3 text-xs text-text-secondary">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong>One-Time Secret Visibility</strong>: The full raw API key is displayed <em>only once</em> upon creation. Save it in your environment variables immediately.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong>HMAC-SHA256 Hashing</strong>: Our database stores only the salted HMAC hash. Even if a DB snapshot were compromised, raw keys cannot be extracted.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong>Key Limits & Lifecycle</strong>: Maximum of 5 keys per merchant account. Keys can be paused, resumed, or deleted immediately from the dashboard.</span>
              </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary mt-6 mb-2">Authentication Header Format</h4>
            <CodeBlock label="AUTHORIZATION HEADER">
              {`Authorization: Bearer sk_live_q8k3mN9xP2wL5vR8tY1zA4bC`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* 2. Webhook: order.payment_completed */}
          <section id="payment-webhook" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                2
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">2. Webhook: order.payment_completed</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              When a customer completes payment via UPI, Credit Card, or Netbanking in the agent widget, ShopAgent sends an asynchronous <code>POST</code> notification to your registered webhook URL.
            </p>

            <CodeBlock label="WEBHOOK PAYLOAD SCHEMA">
              {`{
  "event": "order.payment_completed",
  "event_id": "evt_9f8a3b2c1d",
  "merchant_order_id": "ORD99823"
}`}
            </CodeBlock>

            <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-background text-text-primary font-semibold">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Field</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-text-secondary">
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-primary">event</td>
                    <td className="px-4 py-3 font-mono">string</td>
                    <td className="px-4 py-3">Always <code>"order.payment_completed"</code> for payment capture events</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-primary">event_id</td>
                    <td className="px-4 py-3 font-mono">string (UUID)</td>
                    <td className="px-4 py-3">Unique UUID for this specific event delivery instance</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-primary">merchant_order_id</td>
                    <td className="px-4 py-3 font-mono">string</td>
                    <td className="px-4 py-3">Your store's order ID created during checkout</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-xl border border-error/30 bg-error/5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-error">Critical Webhook Security Rule</h5>
                <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
                  The webhook is intentionally minimal and acts as an <strong>unauthenticated event trigger</strong>. <strong>NEVER mark an order as paid or ship items based on the webhook body alone!</strong> Always invoke <strong>Server-to-Server Order Verification</strong> to fetch authenticated state directly from Razorpay.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* 3. Idempotency & Retries */}
          <section id="idempotency" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                3
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">3. Webhook Idempotency & Retries</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              If your backend server takes longer than 10 seconds to respond or returns a non-2xx status code, ShopAgent will automatically retry webhook delivery up to 3 times using exponential backoff (0.5s, 1.0s, 1.5s).
            </p>

            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary mt-4 mb-2">Recommended Webhook Handler Pattern</h4>
            <CodeBlock label="JAVASCRIPT / NODE.JS EXPRESS HANDLER">
              {`app.post("/api/webhooks/shopagent", async (req, res) => {
  const { event, event_id, merchant_order_id } = req.body;

  // 1. Return 200 OK immediately to acknowledge receipt
  res.status(200).json({ received: true });

  // 2. Deduplicate using event_id (Idempotency Check)
  const alreadyProcessed = await db.processedEvents.find(event_id);
  if (alreadyProcessed) return;

  await db.processedEvents.save(event_id);

  // 3. Call ShopAgent Server-to-Server Order Verification
  const verification = await axios.get(
    \`https://api.shopagent.dev/merchant/orders/verify?merchant_order_id=\${merchant_order_id}\`,
    { headers: { Authorization: \`Bearer \${process.env.SHOPAGENT_API_KEY}\` } }
  );

  // 4. Fulfill order ONLY if payment status is "captured"
  if (verification.data.payment.status === "captured") {
    await fulfillOrder(merchant_order_id);
  }
});`}
            </CodeBlock>
          </section>

          <hr className="my-10 border-border" />

          {/* 4. S2S Order Verification */}
          <section id="s2s-verification" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                4
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">4. Server-to-Server Order Verification</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              This endpoint allows store backends to query the authoritative payment state of any order using your secret API key.
            </p>

            <CodeBlock label="REQUEST">
              {`GET /merchant/orders/verify?merchant_order_id=ORD99823
Authorization: Bearer sk_live_q8k3mN9xP2wL5vR8tY1zA4bC`}
            </CodeBlock>

            <CodeBlock label="AUTHORITATIVE RESPONSE (200 OK)">
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

          {/* 5. Order State Machine */}
          <section id="order-lifecycle" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                5
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">5. Order State Machine</h2>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Every agent order progresses through a strictly defined lifecycle state machine:
            </p>

            <div className="p-4 rounded-xl border border-border bg-surface font-mono text-xs text-center space-y-2">
              <div className="text-text-secondary">initiated</div>
              <div className="text-text-secondary">↓</div>
              <div className="text-text-secondary">merchant_order_created</div>
              <div className="text-text-secondary">↓</div>
              <div className="text-text-secondary">awaiting_payment</div>
              <div className="text-text-secondary">↓</div>
              <div className="text-success font-bold">captured (Fulfill Order)</div>
              <div className="text-error text-[11px] italic mt-1">or failed / flagged_amount_mismatch (Do Not Fulfill)</div>
            </div>

            <div className="overflow-x-auto border border-border rounded-xl shadow-xs mt-4">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-background text-text-primary font-semibold">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Status String</th>
                    <th className="px-4 py-3 font-semibold">Meaning</th>
                    <th className="px-4 py-3 font-semibold">Fulfillment Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-text-secondary">
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-text-primary">initiated</td>
                    <td className="px-4 py-3">Order session started in chat</td>
                    <td className="px-4 py-3">Do not fulfill</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-text-primary">awaiting_payment</td>
                    <td className="px-4 py-3">Razorpay payment link active</td>
                    <td className="px-4 py-3">Do not fulfill</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-success">captured</td>
                    <td className="px-4 py-3">HMAC signature verified & funds captured</td>
                    <td className="px-4 py-3 font-bold text-success">Safe to Fulfill & Ship</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-error">failed</td>
                    <td className="px-4 py-3">Payment failed or cancelled</td>
                    <td className="px-4 py-3 text-error">Do not fulfill</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-error">flagged_amount_mismatch</td>
                    <td className="px-4 py-3">Amount paid didn't match order total</td>
                    <td className="px-4 py-3 text-error font-bold">Hold for manual audit</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* 6. Security Best Practices */}
          <section id="security-best-practices" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                6
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary m-0">6. Security Best Practices</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
                <h4 className="font-bold text-text-primary flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  <span>Keep API Keys Server-Side</span>
                </h4>
                <p className="text-text-secondary leading-relaxed">
                  Never commit <code>sk_live_...</code> keys to git repositories or front-end JS bundles. Store keys in secret management vaults.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
                <h4 className="font-bold text-text-primary flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>Enforce Strict HTTPS</span>
                </h4>
                <p className="text-text-secondary leading-relaxed">
                  Ensure all store endpoints and webhook receiver URLs are protected by valid SSL/TLS certificates.
                </p>
              </div>
            </div>
          </section>
        </article>
      </div>

      {/* Right Sidebar Table of Contents */}
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
