"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChatDemo } from "@/components/ui/ChatDemo";
import { staggerContainer, fadeUpVariant, scaleInVariant } from "@/lib/motion";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowRight,
  Plug,
  ShieldCheck,
  Rocket,
  Code2,
  CreditCard,
  PackageSearch,
  Globe,
  SlidersHorizontal,
  Zap,
  CheckCircle2,
  BookOpen
} from "lucide-react";

export default function MarketingLandingPage() {
  const { isSignedIn } = useAuth();

  return (
    <main className="flex-1 font-sans text-text-primary bg-background">

      {/* 1. Hero Section */}
      <section className="relative overflow-hidden py-8 md:py-12 px-6 md:px-12 border-b border-border bg-background">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="max-w-4xl mx-auto text-center space-y-6 relative z-10"
        >
          {/* Powered by Razorpay Badge */}
          <motion.div variants={fadeUpVariant} className="flex justify-center">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface border border-border text-xs text-text-secondary font-medium shadow-2xs">
              <span>Powered by</span>
              <img
                src="/assets/razorpay_logo.png"
                alt="Razorpay"
                className="h-4.5 w-auto object-contain"
              />
            </div>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            variants={fadeUpVariant}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary max-w-4xl mx-auto leading-[1.15]"
          >
            Transform your online store with conversational AI shopping agents
          </motion.h1>

          {/* Subtitle Description */}
          <motion.p
            variants={fadeUpVariant}
            className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto font-sans leading-relaxed"
          >
            Connect your existing product catalog, saved addresses, and checkout endpoints. Deploy an intelligent shopping assistant that guides buyers and drives real sales.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={fadeUpVariant} className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              <Button
                variant="primary"
                size="lg"
                className="shadow-xs gap-2 px-6 py-3 text-sm font-semibold hover:translate-y-[-1px] transition-transform duration-200"
              >
                <span>{isSignedIn ? "Go to Dashboard" : "Get Started Free"}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <Link href="/documentation">
              <Button
                variant="ghost"
                size="lg"
                className="gap-2 px-6 py-3 text-sm font-semibold border border-border bg-surface hover:bg-background text-text-primary transition-colors"
              >
                <BookOpen className="w-4 h-4 text-primary" />
                <span>View Documentation</span>
              </Button>
            </Link>
          </motion.div>

          {/* Key Highlights */}
          <motion.div
            variants={fadeUpVariant}
            className="pt-6 flex flex-colflex-wrap items-center justify-center gap-6 text-xs text-text-secondary font-medium"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>Zero Database Rewrites</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>Direct Bank Payouts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>5-Minute Setup</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. Interactive Live Demo Showcase */}
      <section className="py-20 md:py-28 border-b border-border bg-surface px-6 md:px-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Pitch content on left */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="lg:col-span-6 space-y-6 text-left"
          >
            <motion.div variants={fadeUpVariant} className="space-y-3">
              <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-text-primary leading-tight">
                See the AI agent in action
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-sans">
                Experience how shoppers search product catalogs, confirm selections, and complete secure payments within the conversation thread.
              </p>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="space-y-4 pt-2">
              <div className="p-4 rounded-xl border border-border bg-background flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Natural Catalog Queries</h4>
                  <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                    Recommends relevant products based on price, category, and customer search terms.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-background flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">In-Chat Payment Capture</h4>
                  <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                    Triggers Razorpay payment requests settled directly to your merchant account.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Live chat mockup on right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-6 flex justify-center"
          >
            <ChatDemo />
          </motion.div>
        </div>
      </section>

      {/* 3. How it Works Section */}
      <section id="how-it-works" className="py-20 md:py-28 border-b border-border bg-background px-6 md:px-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto space-y-14"
        >
          <motion.div variants={fadeUpVariant} className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
              Three Simple Steps to Launch
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed font-sans">
              Connect your existing APIs and deploy your custom AI assistant without rewriting your database.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <motion.div
              variants={fadeUpVariant}
              className="p-6 rounded-2xl border border-border bg-surface space-y-4 hover:border-primary/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Plug className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-heading text-base font-bold text-text-primary">
                  1. Connect Store APIs
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Map your product search, customer login, delivery addresses, and checkout routes in our setup guide.
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              variants={fadeUpVariant}
              className="p-6 rounded-2xl border border-border bg-surface space-y-4 hover:border-primary/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-heading text-base font-bold text-text-primary">
                  2. Set Payout Details
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Provide your settlement bank account and webhook endpoint to receive real-time payment notifications.
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              variants={fadeUpVariant}
              className="p-6 rounded-2xl border border-border bg-surface space-y-4 hover:border-primary/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Rocket className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-heading text-base font-bold text-text-primary">
                  3. Deploy & Convert
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Launch your custom AI widget on your storefront or assigned domain to greet visitors and complete sales.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* 4. Key Features Grid */}
      <section id="features" className="py-20 md:py-28 border-b border-border bg-surface px-6 md:px-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto space-y-14"
        >
          <motion.div variants={fadeUpVariant} className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
              Built for Security, Speed & Control
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed font-sans">
              Isolate customer sessions, protect merchant API keys, and streamline catalog queries.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div variants={fadeUpVariant} className="p-5 rounded-2xl border border-border bg-background space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Code2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary font-heading">No-Code Endpoint Integration</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Connect existing HTTPS APIs effortlessly without database migrations or code rewrites.
              </p>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="p-5 rounded-2xl border border-border bg-background space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary font-heading">Secure Auth Delegation</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Authenticate users securely using your native login endpoints without exposing passwords.
              </p>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="p-5 rounded-2xl border border-border bg-background space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary font-heading">Direct Payout Settlements</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Receive payment proceeds directly into your verified bank account balance upon transaction capture.
              </p>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="p-5 rounded-2xl border border-border bg-background space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <PackageSearch className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary font-heading">Automated Order Tracking</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Let customers query order history, shipping updates, and item status directly in conversation.
              </p>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="p-5 rounded-2xl border border-border bg-background space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary font-heading">Subdomain & Brand Customization</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Personalize widget display names, brand accent colors, and store logos on your assigned subdomains.
              </p>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="p-5 rounded-2xl border border-border bg-background space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary font-heading">Server-to-Server Verification</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Verify every payment transaction using API key authentication before fulfilling orders.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* 5. Final CTA Section */}
      <section className="py-16 md:py-24 px-6 md:px-12 bg-background">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={scaleInVariant}
          className="max-w-3xl mx-auto text-center space-y-6 rounded-2xl border border-border bg-surface p-10 md:p-16 shadow-xs"
        >
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            Ready to launch your AI shopping assistant?
          </h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed font-sans">
            Join store owners who connect their APIs and deploy intelligent shopping agents.
          </p>
          <div className="pt-2 flex justify-center">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              <Button variant="primary" size="lg" className="shadow-xs gap-2 px-6 py-3 text-sm font-semibold">
                <span>{isSignedIn ? "Go to Dashboard" : "Get Started Free"}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
