"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StepItem } from "@/components/ui/StepItem";
import { FeatureItem } from "@/components/ui/FeatureItem";
import { ChatDemo } from "@/components/ui/ChatDemo";
import { staggerContainer, fadeUpVariant, scaleInVariant } from "@/lib/motion";
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
} from "lucide-react";

export default function MarketingLandingPage() {
  return (
    <main className="flex-1">
      {/* 1. Hero Section with Backdrop Image */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center justify-center py-20 px-6 md:px-12 border-b border-border bg-background">
        {/* Responsive Backdrop Image */}
        <img
          src="/assets/hero_backdrop.png"
          alt="Hero Backdrop decoration"
          className="fixed pointer-events-none z-0 opacity-35 select-none
                     md:inset-0 md:w-full md:h-full md:object-cover
                     max-md:bottom-0 max-md:right-0 max-md:top-auto max-md:left-auto max-md:w-3/5 max-md:h-1/2 max-md:object-contain"
        />

        {/* Subtle grid background pattern with radial fade */}
        <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none z-0" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="max-w-4xl mx-auto text-center space-y-6 relative z-10"
        >
          <motion.h1
            variants={fadeUpVariant}
            className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary max-w-3xl mx-auto leading-tight"
          >
            Your AI shopping agent, <br />
            live in minutes.
          </motion.h1>
          <motion.p
            variants={fadeUpVariant}
            className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto font-sans leading-relaxed"
          >
            Link your store database and settlement details to deploy conversational checkout assistants that interact, sell, and payout directly to you.
          </motion.p>
          <motion.div variants={fadeUpVariant} className="pt-4">
            <Link href="/signup">
              <Button
                variant="primary"
                size="lg"
                className="shadow-sm gap-2 hover:translate-y-[-1px] transition-transform duration-200"
              >
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. How it works Section */}
      <section
        id="how-it-works"
        className="relative z-20 py-20 md:py-28 border-b border-border bg-surface px-6 md:px-12"
      >
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 bg-grid pointer-events-none z-0" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto space-y-16 relative z-10"
        >
          <motion.div variants={fadeUpVariant} className="text-center md:text-left">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-text-primary">
              Minimal Integration. Maximum Control.
            </h2>
            <p className="text-base text-text-secondary mt-2 max-w-xl">
              Setting up your merchant store profile and deploying checkout helpers is three simple steps.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14">
            <StepItem
              number="01"
              label="Connect your APIs"
              description="Provide your products, orders, customers, and auth endpoints in a single onboarding dashboard."
              icon={Plug}
            />
            <StepItem
              number="02"
              label="Grant access"
              description="Provide bank settlement details to receive checkout balances. No payment keys are shared."
              icon={ShieldCheck}
            />
            <StepItem
              number="03"
              label="Go live"
              description="Deploy your custom AI widget instantly on your brand subdomain to greet shoppers."
              icon={Rocket}
            />
          </div>

          {/* Monospace Subdomain Emphasized Line */}
          <motion.div
            variants={scaleInVariant}
            className="pt-10 border-t border-border/80 text-center"
          >
            <p className="text-base md:text-lg text-primary font-semibold">
              Your assistant is deployed instantly at{" "}
              <span className="font-mono bg-primary-light px-3 py-1.5 rounded-lg text-primary border border-primary/10">
                agent.yourstore.com
              </span>
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* 3. Live Demo Section */}
      <section className="relative z-20 bg-background border-b border-border py-20 md:py-28 px-6 md:px-12">
        {/* Subtle grid background pattern with radial fade */}
        <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none z-0" />

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Pitch content on left */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="lg:col-span-7 space-y-6 text-left"
          >
            <motion.h2
              variants={fadeUpVariant}
              className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-text-primary leading-tight"
            >
              Observe the checkout assistant in real-time.
            </motion.h2>
            <motion.p
              variants={fadeUpVariant}
              className="text-base text-text-secondary leading-relaxed font-sans"
            >
              Shoppers query stock catalogs, confirm product selections, and trigger automated secure payment requests within the conversational thread.
            </motion.p>
            <motion.div variants={fadeUpVariant} className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-success font-bold text-base mt-0.5">&bull;</span>
                <p className="text-sm text-text-secondary">
                  <strong>Natural Catalog Queries</strong>: Recommends velocity products based on user price boundaries.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-success font-bold text-base mt-0.5">&bull;</span>
                <p className="text-sm text-text-secondary">
                  <strong>Conversational Payment Links</strong>: Generates dynamic checkout requests settled directly to your merchant account.
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Live chat mockup on right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-5 flex justify-center"
          >
            <ChatDemo />
          </motion.div>
        </div>
      </section>

      {/* 4. Features Section */}
      <section
        id="features"
        className="relative z-20 py-20 md:py-28 border-b border-border bg-surface px-6 md:px-12"
      >
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 bg-grid pointer-events-none z-0" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto space-y-16 relative z-10"
        >
          <motion.div variants={fadeUpVariant} className="text-center md:text-left">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-text-primary">
              Built for Enterprise Security
            </h2>
            <p className="text-base text-text-secondary mt-2 max-w-xl">
              A robust merchant checkout architecture that isolates customer sessions from data leakages.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-14">
            <FeatureItem
              icon={Code2}
              title="No-Code Setup"
              description="Sync your store endpoints and verify credentials in seconds. Launch without writing a single line of backend glue."
            />
            <FeatureItem
              icon={ShieldCheck}
              title="Secure Auth Delegation"
              description="Customers authenticate with their existing native credentials. We never store customer passwords or tokens."
            />
            <FeatureItem
              icon={CreditCard}
              title="Direct Payout Settlements"
              description="Funds transfer directly into your verified bank account balance. Secret merchant keys are never exposed."
            />
            <FeatureItem
              icon={PackageSearch}
              title="Automated Order Tracking"
              description="Includes built-in modules checking shipment status, order history, and confirmation updates directly."
            />
            <FeatureItem
              icon={Globe}
              title="Subdomain Branding"
              description="Fully customize assistant widget names, primary accent colors, and brand avatar logos on your own subdomains."
            />
            <FeatureItem
              icon={SlidersHorizontal}
              title="Transaction Threshold Controls"
              description="Establish manual approval thresholds in settings to monitor payment links exceeding custom boundaries."
            />
          </div>
        </motion.div>
      </section>

      {/* 5. Final CTA Section */}
      <section className="relative z-20 bg-background py-16 px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={scaleInVariant}
          className="max-w-3xl mx-auto text-center space-y-6 relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-background p-12 md:p-20 shadow-xs z-10"
        >
          <h2 className="font-heading text-3xl font-bold tracking-tight text-text-primary">
            Ready to launch your AI shopping assistant?
          </h2>
          <p className="text-base text-text-secondary leading-relaxed font-sans">
            Create your account today and connect your endpoints to launch your merchant agent.
          </p>
          <div className="pt-4">
            <Link href="/signup">
              <Button variant="primary" size="lg" className="shadow-sm gap-2">
                <span>Get Started Now</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
