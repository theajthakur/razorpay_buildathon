"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  Search,
  Rocket,
  Key,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  ChevronRight
} from "lucide-react";

interface FaqItem {
  id: string;
  category: "onboarding" | "keys" | "webhooks" | "troubleshooting";
  question: string;
  answer: React.ReactNode;
}

const faqData: FaqItem[] = [
  {
    id: "faq-1",
    category: "onboarding",
    question: "Do I need to rewrite my store backend or change my database schema?",
    answer: (
      <p>
        <strong>No!</strong> ShopAgent is designed to wrap seamlessly around your existing HTTPS API endpoints. You simply map your store's login, product search, address lookup, and checkout URLs in our onboarding dashboard without modifying your internal database schemas.
      </p>
    ),
  },
  {
    id: "faq-2",
    category: "onboarding",
    question: "What if my product catalog returns non-standard JSON keys?",
    answer: (
      <p>
        ShopAgent includes an automatic normalizer that checks for standard key candidates (e.g. <code>id</code>/<code>_id</code>, <code>name</code>/<code>title</code>, <code>price</code>, <code>thumbnailUrl</code>/<code>image</code>). If your backend uses custom property names, you can specify individual payload key mappings during onboarding.
      </p>
    ),
  },
  {
    id: "faq-3",
    category: "keys",
    question: "Where do I get my API key and what format does it use?",
    answer: (
      <p>
        You can create API keys in your <strong>ShopAgent Dashboard</strong> under <strong>API Keys</strong>. All keys follow the format <code>sk_live_&lt;24_base64url_bytes&gt;</code>. Secret keys are displayed <em>only once</em> upon creation for maximum security.
      </p>
    ),
  },
  {
    id: "faq-4",
    category: "keys",
    question: "What is the maximum limit of API keys per merchant account?",
    answer: (
      <p>
        Each merchant account can maintain up to <strong>5 API keys</strong> (counting active and paused keys). If you hit this limit, you can delete or revoke an old key from the dashboard before creating a new one.
      </p>
    ),
  },
  {
    id: "faq-5",
    category: "webhooks",
    question: "Should I trust the order.payment_completed webhook body to mark orders as paid?",
    answer: (
      <p>
        <strong>No!</strong> The webhook payload is intentionally minimal and acts as an unauthenticated event trigger. On receipt, return <code>200 OK</code> immediately, then call our <strong>Server-to-Server Order Verification</strong> endpoint (<code>GET /merchant/orders/verify?merchant_order_id=...</code>) carrying your secret API key to fetch the authoritative Razorpay status.
      </p>
    ),
  },
  {
    id: "faq-6",
    category: "webhooks",
    question: "How does ShopAgent handle webhook retries and duplicate events?",
    answer: (
      <p>
        If your webhook server returns a non-2xx status code or times out (&gt;10s), ShopAgent retries delivery up to 3 times with exponential backoff. Every webhook contains a unique <code>event_id</code> (UUID). Your server should deduplicate using this <code>event_id</code> to guarantee idempotency.
      </p>
    ),
  },
  {
    id: "faq-7",
    category: "troubleshooting",
    question: "How do I test webhook events locally on my dev machine?",
    answer: (
      <p>
        Use a secure tunneling utility like <code>ngrok</code> (e.g. <code>ngrok http 8000</code>) to expose your local development server to the internet. Register the generated <code>https://....ngrok-free.app/webhook/merchant-os</code> URL in your merchant onboarding settings.
      </p>
    ),
  },
  {
    id: "faq-8",
    category: "troubleshooting",
    question: "What happens if a customer's payment is captured but the amount doesn't match the order total?",
    answer: (
      <p>
        The order status will be set to <code>flagged_amount_mismatch</code>. ShopAgent flags the order for manual audit so store administrators can review the transaction before shipping items.
      </p>
    ),
  },
];

export default function FaqClient() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openIds, setOpenIds] = useState<string[]>(["faq-1", "faq-5"]);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const toggleFaq = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredFaqs = faqData.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesQuery =
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (typeof item.answer === "string" && item.answer.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  const handleCopyMarkdown = () => {
    const markdown = `# Common FAQs - ShopAgent Documentation
- Store Backend Compatibility: Wrap existing HTTPS endpoints without DB changes.
- API Key Format: sk_live_<24 base64url bytes>
- Webhook Rule: Webhook is a trigger; call GET /merchant/orders/verify for authoritative status.`;
    navigator.clipboard.writeText(markdown);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="flex-1 max-w-full lg:max-w-[72ch] min-w-0 font-sans">
      
      {/* Header Banner */}
      <div className="mb-8 p-4 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-text-primary">Frequently Asked Questions & Troubleshooting</h4>
            <p className="text-[11px] text-text-secondary">Answers to common onboarding, API key, webhook, and verification questions.</p>
          </div>
        </div>
        <button
          onClick={handleCopyMarkdown}
          className={`px-3.5 py-1.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border ${
            copiedRaw ? "bg-success border-success text-text-on-primary" : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover"
          }`}
        >
          {copiedRaw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedRaw ? "Copied FAQs!" : "Copy FAQ Summary"}</span>
        </button>
      </div>

      <article className="prose max-w-none">
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-4">
          Common FAQs & Best Practices
        </h1>
        <p className="text-base text-text-secondary leading-relaxed mb-6">
          Find instant answers to integration questions, security rules, webhook behavior, and troubleshooting steps.
        </p>

        {/* Filter Controls */}
        <div className="my-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-sans"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All Questions" },
              { id: "onboarding", label: "🚀 Onboarding" },
              { id: "keys", label: "🔑 API Keys" },
              { id: "webhooks", label: "💳 Webhooks & Verify" },
              { id: "troubleshooting", label: "⚙️ Troubleshooting" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 text-xs rounded-xl font-medium cursor-pointer transition-all border ${
                  selectedCategory === tab.id
                    ? "bg-primary border-primary text-text-on-primary font-semibold shadow-xs"
                    : "bg-surface border-border text-text-secondary hover:text-text-primary hover:bg-background"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3 my-8">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className="rounded-2xl border border-border bg-surface overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:bg-background/50 transition-colors gap-4"
                  >
                    <span className="text-sm font-bold text-text-primary font-heading">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-primary shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-text-secondary leading-relaxed border-t border-border/50 bg-background/30 animate-in fade-in duration-200">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-text-secondary border border-border rounded-2xl bg-surface">
              No matching questions found. Try searching for different keywords or select "All Questions".
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
