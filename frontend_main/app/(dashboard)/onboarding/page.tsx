"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { EndpointRow } from "@/components/ui/EndpointRow";
import { StatusBadge, StatusType } from "@/components/ui/StatusBadge";
import { BadgeCheck, Landmark, ShieldCheck, Database, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { fetchOnboardingDetails, saveOnboardingDetails, testEndpoint } from "@/lib/api/onboarding";

export default function OnboardingPage() {
  const router = useRouter();

  // Loading and saving states
  const [pageLoading, setPageLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // Part A: Shared Connection Details State
  const [baseUrl, setBaseUrl] = useState("https://api.acmestore.com/v1");
  const [requireAuth, setRequireAuth] = useState(true);
  const [authMethod, setAuthMethod] = useState("bearer");
  const [credentialValue, setCredentialValue] = useState("tok_live_secret12345");

  // Part B: Endpoints State
  const [endpoints, setEndpoints] = useState({
    products: { path: "products", method: "GET" },
    orders: { path: "orders", method: "POST" },
    customers: { path: "customers", method: "GET" },
    auth: { path: "auth", method: "POST" },
    orderHistory: { path: "orders/history", method: "GET" },
  });

  const [endpointStatuses, setEndpointStatuses] = useState<{
    products: StatusType;
    orders: StatusType;
    customers: StatusType;
    auth: StatusType;
    orderHistory: StatusType;
  }>({
    products: "untested",
    orders: "untested",
    customers: "untested",
    auth: "untested",
    orderHistory: "untested",
  });

  // Bank Settlement Account State
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [ifscError, setIfscError] = useState("");
  const [resolvedBank, setResolvedBank] = useState("");
  const [resolvedBranch, setResolvedBranch] = useState("");
  const [bankVerified, setBankVerified] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);

  // Load existing onboarding details on mount
  useEffect(() => {
    async function loadOnboarding() {
      try {
        const config = await fetchOnboardingDetails();
        if (config) {
          setBaseUrl(config.base_url);
          setRequireAuth(config.auth_needed);
          if (config.auth_method) setAuthMethod(config.auth_method);
          if (config.credential_value) setCredentialValue(config.credential_value);
          if (config.endpoints) {
            setEndpoints(config.endpoints as any);
          }
          if (config.bank_account) setBankAccount(config.bank_account);
          if (config.ifsc) {
            setIfsc(config.ifsc);
            // Trigger IFSC Lookup immediately to auto-resolve bank name & branch
            handleIfscLookup(config.ifsc);
          }
          
          // Mark endpoints as tested and successful since they were previously saved
          setEndpointStatuses({
            products: "success",
            orders: "success",
            customers: "success",
            auth: "success",
            orderHistory: "success",
          });
        }
      } catch (err) {
        console.error("Failed to load onboarding info: ", err);
      } finally {
        setPageLoading(false);
      }
    }
    loadOnboarding();
  }, []);

  // Reset endpoint test statuses if connection properties change
  useEffect(() => {
    // Prevent clearing statuses on first initial load
    if (pageLoading) return;
    setEndpointStatuses({
      products: "untested",
      orders: "untested",
      customers: "untested",
      auth: "untested",
      orderHistory: "untested",
    });
  }, [baseUrl, requireAuth, authMethod, credentialValue]);

  const handleEndpointChange = (
    key: keyof typeof endpoints,
    field: "path" | "method",
    val: string
  ) => {
    setEndpoints((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
    setEndpointStatuses((prev) => ({
      ...prev,
      [key]: "untested",
    }));
  };

  const handleTestEndpoint = async (key: keyof typeof endpoints) => {
    setEndpointStatuses((prev) => ({ ...prev, [key]: "pending" }));
    try {
      const result = await testEndpoint({
        base_url: baseUrl,
        auth_needed: requireAuth,
        auth_method: requireAuth ? authMethod : null,
        credential_value: requireAuth ? credentialValue : null,
        path: endpoints[key].path,
        method: endpoints[key].method,
      });

      setEndpointStatuses((prev) => ({
        ...prev,
        [key]: result.status === "success" ? "success" : "error",
      }));
    } catch (err) {
      console.error(err);
      setEndpointStatuses((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const handleIfscLookup = async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    setIfsc(cleaned);

    if (cleaned.length !== 11) {
      setResolvedBank("");
      setResolvedBranch("");
      setBankVerified(false);
      setIfscError("");
      return;
    }

    setBankLoading(true);
    setIfscError("");

    try {
      const res = await fetch(`https://ifsc.razorpay.com/${cleaned}`);
      if (!res.ok) {
        throw new Error("Invalid IFSC");
      }
      const data = await res.json();
      setResolvedBank(data.BANK);
      setResolvedBranch(data.BRANCH);
      setBankVerified(true);
    } catch (err) {
      setIfscError("Failed to detect branch. Please check the IFSC code.");
      setResolvedBank("");
      setResolvedBranch("");
      setBankVerified(false);
    } finally {
      setBankLoading(false);
    }
  };

  const handleFinish = async () => {
    setSaveLoading(true);
    try {
      await saveOnboardingDetails({
        base_url: baseUrl,
        auth_needed: requireAuth,
        auth_method: requireAuth ? authMethod : null,
        credential_value: requireAuth ? credentialValue : null,
        endpoints,
        bank_account: bankAccount,
        ifsc,
        branch_name: resolvedBranch || resolvedBank || "Verified Branch",
      });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to save onboarding configuration: ", err);
    } finally {
      setSaveLoading(false);
    }
  };

  // Onboarding Completion Criteria
  const isSharedCredsValid =
    baseUrl.trim() !== "" && (!requireAuth || credentialValue.trim() !== "");

  const allEndpointsSuccess =
    endpointStatuses.products === "success" &&
    endpointStatuses.orders === "success" &&
    endpointStatuses.customers === "success" &&
    endpointStatuses.auth === "success" &&
    endpointStatuses.orderHistory === "success";

  const isBankSetupValid = bankAccount.trim().length >= 8 && bankVerified;

  const isSetupComplete =
    isSharedCredsValid && allEndpointsSuccess && isBankSetupValid;

  if (pageLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-semibold text-text-secondary animate-pulse">
          Loading Onboarding Profile...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Title Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Connect Your Business APIs
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Provide your endpoint coordinates, authentication settings, and payout account details to complete setup.
        </p>
      </div>

      {/* Part A: Shared Connection Details Card */}
      <Card
        title="1. Shared Connection Details"
        description="Configure the base URL and authorization scheme. These credentials are used for all endpoint verifications below."
      >
        <div className="space-y-6">
          <Input
            label="API Base URL"
            placeholder="https://api.yourstore.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
            disabled={saveLoading}
          />

          <div className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Authentication Required?
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Enable if your API endpoints require api-keys, bearer tokens, or basic authorization headers.
              </p>
            </div>
            <Switch
              checked={requireAuth}
              onCheckedChange={setRequireAuth}
              disabled={saveLoading}
            />
          </div>

          {requireAuth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Authentication Method
                </label>
                <select
                  value={authMethod}
                  onChange={(e) => setAuthMethod(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
                  disabled={saveLoading}
                >
                  <option value="apikey">API Key</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                </select>
              </div>

              <Input
                label={
                  authMethod === "basic"
                    ? "Username:Password (Base64)"
                    : authMethod === "bearer"
                    ? "Bearer Token"
                    : "API Key Header Value"
                }
                type="password"
                placeholder="••••••••"
                value={credentialValue}
                onChange={(e) => setCredentialValue(e.target.value)}
                required
                disabled={saveLoading}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Part B: Endpoints Mapping Card */}
      <Card
        title="2. Resource Endpoints"
        description="Verify individual endpoint resource routes. You must test and confirm success on each row."
      >
        <div className="divide-y divide-border">
          <EndpointRow
            label="Products API"
            path={endpoints.products.path}
            method={endpoints.products.method}
            onPathChange={(p) => handleEndpointChange("products", "path", p)}
            onMethodChange={(m) => handleEndpointChange("products", "method", m)}
            onTest={() => handleTestEndpoint("products")}
            testStatus={endpointStatuses.products}
            disabled={!isSharedCredsValid || saveLoading}
          />

          <EndpointRow
            label="Orders API"
            path={endpoints.orders.path}
            method={endpoints.orders.method}
            onPathChange={(p) => handleEndpointChange("orders", "path", p)}
            onMethodChange={(m) => handleEndpointChange("orders", "method", m)}
            onTest={() => handleTestEndpoint("orders")}
            testStatus={endpointStatuses.orders}
            disabled={!isSharedCredsValid || saveLoading}
          />

          <EndpointRow
            label="Customers API"
            path={endpoints.customers.path}
            method={endpoints.customers.method}
            onPathChange={(p) => handleEndpointChange("customers", "path", p)}
            onMethodChange={(m) => handleEndpointChange("customers", "method", m)}
            onTest={() => handleTestEndpoint("customers")}
            testStatus={endpointStatuses.customers}
            disabled={!isSharedCredsValid || saveLoading}
          />

          <EndpointRow
            label="Auth API"
            path={endpoints.auth.path}
            method={endpoints.auth.method}
            onPathChange={(p) => handleEndpointChange("auth", "path", p)}
            onMethodChange={(m) => handleEndpointChange("auth", "method", m)}
            onTest={() => handleTestEndpoint("auth")}
            testStatus={endpointStatuses.auth}
            disabled={!isSharedCredsValid || saveLoading}
          />

          <EndpointRow
            label="Order History"
            path={endpoints.orderHistory.path}
            method={endpoints.orderHistory.method}
            onPathChange={(p) => handleEndpointChange("orderHistory", "path", p)}
            onMethodChange={(m) => handleEndpointChange("orderHistory", "method", m)}
            onTest={() => handleTestEndpoint("orderHistory")}
            testStatus={endpointStatuses.orderHistory}
            disabled={!isSharedCredsValid || saveLoading}
          />
        </div>
      </Card>

      {/* Part C: Settlement Bank Target */}
      <Card
        title="3. Settlement Bank Account"
        description="Provide your business deposit details to route payouts from Razorpay transaction completions."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Bank Account Number"
              type="text"
              placeholder="09280192839128"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
              required
              disabled={saveLoading}
            />

            <div className="relative">
              <Input
                label="IFSC Code"
                type="text"
                placeholder="HDFC0000261"
                value={ifsc}
                onChange={(e) => handleIfscLookup(e.target.value)}
                maxLength={11}
                error={ifscError}
                required
                disabled={saveLoading}
              />
              {bankLoading && (
                <span className="absolute right-3 top-9 text-xs text-text-secondary animate-pulse">
                  Validating...
                </span>
              )}
            </div>
          </div>

          {bankVerified && resolvedBank && (
            <div className="p-4 border border-success/20 bg-success/5 rounded-lg flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3">
                <Landmark className="w-6 h-6 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-text-primary">
                    {resolvedBank}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Branch: {resolvedBranch} &bull; Route Verified
                  </p>
                </div>
              </div>
              <StatusBadge status="success" message="Branch Active" />
            </div>
          )}
        </div>
      </Card>

      {/* Complete Setup Action Banner */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {isSetupComplete ? (
              <BadgeCheck className="w-8 h-8 text-success shrink-0" />
            ) : (
              <Database className="w-8 h-8 text-text-secondary shrink-0" />
            )}
            <div>
              <p className="font-semibold text-text-primary">
                {isSetupComplete ? "All Integration Rules Met" : "Pending Setup Configuration"}
              </p>
              <p className="text-xs text-text-secondary">
                {isSetupComplete
                  ? "Your endpoints, credentials, and settlement bank have been verified successfully."
                  : "All 5 endpoints and the bank settlement lookup must be verified to complete setup."}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleFinish}
            disabled={!isSetupComplete || saveLoading}
            className="flex items-center gap-2 shadow-xs min-w-[140px] justify-center"
          >
            {saveLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span>Finish Setup</span>
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
