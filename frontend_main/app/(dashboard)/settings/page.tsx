"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { Check, Settings, Sliders, Shield, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMerchantSettings,
  updateMerchantSettings,
} from "@/lib/api/settings";
import {
  ReusableSkeleton,
  SettingsPageSkeleton,
} from "@/components/ui/Skeleton";

export default function SettingsPage() {
  // Initial database values for dirty checking
  const [initialSettings, setInitialSettings] = useState<{
    agentName: string;
    confirmationLimit: number;
    toggles: {
      historyLookup: boolean;
      cartNegotiation: boolean;
      autoCoupons: boolean;
      smartUpsell: boolean;
    };
  } | null>(null);

  // Agent configuration states
  const [agentName, setAgentName] = useState("Acme Shopping Assistant");
  const [confirmationLimit, setConfirmationLimit] = useState(5000);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Domain configuration states
  const [assignedDomain, setAssignedDomain] = useState<string | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Toggles state
  const [toggles, setToggles] = useState({
    historyLookup: true,
    cartNegotiation: true,
    autoCoupons: false,
    smartUpsell: true,
  });

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const data = await fetchMerchantSettings();

        const name = data.display_name || "Acme Shopping Assistant";
        const limit = data.confirmation_limit ?? 5000;
        const loadedToggles = {
          historyLookup: data.toggles?.historyLookup ?? true,
          cartNegotiation: data.toggles?.cartNegotiation ?? true,
          autoCoupons: data.toggles?.autoCoupons ?? false,
          smartUpsell: data.toggles?.smartUpsell ?? true,
        };

        setAgentName(name);
        setConfirmationLimit(limit);
        setToggles(loadedToggles);

        if (data.assigned_domain) {
          setAssignedDomain(data.assigned_domain);
        }

        setInitialSettings({
          agentName: name,
          confirmationLimit: limit,
          toggles: loadedToggles,
        });
      } catch (err: any) {
        console.error("Failed to load settings:", err);
        toast.error("Failed to load settings. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      const updated = await updateMerchantSettings({
        display_name: agentName,
        confirmation_limit: confirmationLimit,
        toggles: toggles,
      });

      const name = updated.display_name || "Acme Shopping Assistant";
      const limit = updated.confirmation_limit ?? 5000;
      const loadedToggles = {
        historyLookup: updated.toggles?.historyLookup ?? true,
        cartNegotiation: updated.toggles?.cartNegotiation ?? true,
        autoCoupons: updated.toggles?.autoCoupons ?? false,
        smartUpsell: updated.toggles?.smartUpsell ?? true,
      };

      setAgentName(name);
      setConfirmationLimit(limit);
      setToggles(loadedToggles);

      setInitialSettings({
        agentName: name,
        confirmationLimit: limit,
        toggles: loadedToggles,
      });

      setSaveSuccess(true);
      toast.success("Settings saved successfully!");
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast.error(err.response?.data?.detail || "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = initialSettings ? (
    agentName !== initialSettings.agentName ||
    confirmationLimit !== initialSettings.confirmationLimit ||
    toggles.historyLookup !== initialSettings.toggles.historyLookup ||
    toggles.cartNegotiation !== initialSettings.toggles.cartNegotiation ||
    toggles.autoCoupons !== initialSettings.toggles.autoCoupons ||
    toggles.smartUpsell !== initialSettings.toggles.smartUpsell
  ) : false;

  return (
    <ReusableSkeleton name="settings-page" loading={isLoading} fallback={<SettingsPageSkeleton />}>
      <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Title Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Agent Settings
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure features and risk limits for the customer-facing AI agent.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Domain Assigned Success Banner */}
        {assignedDomain && !isBannerDismissed && (
          <div className="p-4 bg-success/10 border border-success/20 text-success rounded-xl flex items-center justify-between text-sm font-semibold transition-all animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span role="img" aria-label="party">🎉</span>
              <span>
                Your domain has been assigned: <strong>{assignedDomain}</strong> — your AI shopping agent is live.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsBannerDismissed(true)}
              className="p-1 rounded-md hover:bg-success/20 text-success/80 hover:text-success transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Save success banner */}
        {saveSuccess && (
          <div className="p-4 bg-success/10 border border-success/20 text-success rounded-xl flex items-center gap-2 text-sm font-semibold transition-all">
            <Check className="w-5 h-5" />
            <span>Settings saved successfully!</span>
          </div>
        )}

        {/* Unsaved changes alert */}
        {isDirty && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center gap-2 text-sm font-medium transition-all">
            <AlertTriangle className="w-5 h-5" />
            <span>You have unsaved changes. Please make sure to save before leaving.</span>
          </div>
        )}

        {/* 1. General Settings Card */}
        <Card
          title="General Settings"
          description="Configure the primary identity details for the shopper widget."
        >
          <div className="max-w-lg space-y-4">
            <Input
              label="Agent Assistant Name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. Acme Helper"
              required
            />
          </div>
        </Card>

        {/* 2. Operations & Toggles */}
        <Card
          title="Capabilities & Behavior"
          description="Toggle automated AI services and features active on checkout conversations."
        >
          <div className="divide-y divide-border">
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${toggles.historyLookup ? "bg-primary" : "bg-border"
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${toggles.historyLookup ? "translate-x-5" : "translate-x-0"
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${toggles.cartNegotiation ? "bg-primary" : "bg-border"
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${toggles.cartNegotiation ? "translate-x-5" : "translate-x-0"
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${toggles.autoCoupons ? "bg-primary" : "bg-border"
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${toggles.autoCoupons ? "translate-x-5" : "translate-x-0"
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${toggles.smartUpsell ? "bg-primary" : "bg-border"
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${toggles.smartUpsell ? "translate-x-5" : "translate-x-0"
                    }`}
                />
              </button>
            </div>
          </div>
        </Card>

        {/* 3. Payment & Security Limits */}
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

        {/* 4. Developer Settings */}
        <Card
          title="Developer API Keys"
          description="Manage secret API keys to authenticate and integrate external checkout platforms."
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-md">
              <p className="text-sm text-text-secondary">
                Generate, pause, or delete keys to authenticate incoming requests from your custom shop integration.
              </p>
            </div>
            <Link href="/settings/api-keys">
              <Button type="button" variant="secondary" className="w-full sm:w-auto font-semibold">
                Manage API Keys
              </Button>
            </Link>
          </div>
        </Card>

        {/* Submission Panel */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="shadow-xs"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
    </ReusableSkeleton>
  );
}
