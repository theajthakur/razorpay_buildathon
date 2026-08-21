"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { Check, Settings, Sparkles, Sliders, Shield } from "lucide-react";

export default function SettingsPage() {
  // Agent configuration states
  const [agentName, setAgentName] = useState("Acme Shopping Assistant");
  const [agentColor, setAgentColor] = useState("#4338CA");
  const [confirmationLimit, setConfirmationLimit] = useState(5000);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Toggles state
  const [toggles, setToggles] = useState({
    historyLookup: true,
    cartNegotiation: true,
    autoCoupons: false,
    smartUpsell: true,
  });

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Title Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Agent Settings
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure branding, features, and risk limits for the customer-facing AI agent.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Save success banner */}
        {saveSuccess && (
          <div className="p-4 bg-success/10 border border-success/20 text-success rounded-xl flex items-center gap-2 text-sm font-semibold transition-all">
            <Check className="w-5 h-5" />
            <span>Settings saved successfully!</span>
          </div>
        )}

        {/* 1. Branding Card */}
        <Card
          title="Agent Branding"
          description="Customize the appearance and identity of your shopper widget."
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Agent Assistant Name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Acme Helper"
                required
              />

              {/* Custom Widget Color */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Widget Primary Accent Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={agentColor}
                    onChange={(e) => setAgentColor(e.target.value)}
                    className="w-11 h-11 border border-border rounded-lg cursor-pointer bg-surface p-1"
                  />
                  <div className="flex-1">
                    <Input
                      value={agentColor.toUpperCase()}
                      onChange={(e) => setAgentColor(e.target.value)}
                      placeholder="#4338CA"
                      maxLength={7}
                    />
                  </div>
                </div>
                <p className="text-xs text-text-secondary mt-1.5">
                  Defines custom buttons and headers inside the conversational window.
                </p>
              </div>
            </div>

            {/* Avatar Logo Placeholder */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Agent Widget Logo
              </label>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center text-text-secondary hover:text-primary hover:border-primary transition-colors cursor-pointer"
                  role="presentation"
                >
                  <Sparkles className="w-6 h-6" />
                  <span className="text-[10px] font-semibold mt-1">Upload</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Default Avatar Active
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Supports PNG, JPG, or SVG. Suggested size 512x512px.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Operations & Toggles */}
        <Card
          title="Capabilities & Behavior"
          description="Toggle automated AI services and features active on checkout conversations."
        >
          <div className="divide-y divide-border space-y-4">
            {/* Toggle 1 */}
            <div className="flex items-center justify-between py-2 first:pt-0">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Order History Lookup
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Allow the agent to search merchant endpoints to report active delivery states.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("historyLookup")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggles.historyLookup ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
                    toggles.historyLookup ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2 */}
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Cart Price Negotiation
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Allow the agent to dynamically lower checkout totals based on customer purchase patterns.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("cartNegotiation")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggles.cartNegotiation ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
                    toggles.cartNegotiation ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3 */}
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Auto-Apply Coupon Codes
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Permit agents to lookup active campaigns and auto-calculate checkout price drops.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("autoCoupons")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggles.autoCoupons ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
                    toggles.autoCoupons ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 4 */}
            <div className="flex items-center justify-between py-4 last:pb-0">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Smart Catalog Upsell
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Incorporate secondary related product proposals inside customer recommendations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("smartUpsell")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggles.smartUpsell ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
                    toggles.smartUpsell ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        {/* 3. Transaction Threshold limits */}
        <Card
          title="Payment & Security Limits"
          description="Manage financial constraints and manual verification boundaries."
        >
          <div className="max-w-lg space-y-4">
            <Input
              label="Human Confirmation Threshold (INR)"
              type="number"
              value={confirmationLimit}
              onChange={(e) => setConfirmationLimit(Number(e.target.value))}
              placeholder="e.g. 5000"
              helperText="Requires secondary manual approval for payment links exceeding this amount."
              required
            />
          </div>
        </Card>

        {/* Submission Panel */}
        <div className="flex items-center justify-end">
          <Button type="submit" variant="primary" size="lg" className="shadow-xs">
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
