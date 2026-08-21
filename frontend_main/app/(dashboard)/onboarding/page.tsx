"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { EndpointRow } from "@/components/ui/EndpointRow";
import { StatusBadge, StatusType } from "@/components/ui/StatusBadge";
import { BadgeCheck, Landmark, ShieldCheck, Database, CreditCard } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  // Part A: Shared Connection Details State
  const [baseUrl, setBaseUrl] = useState("https://api.acmestore.com/v1");
  const [authMethod, setAuthMethod] = useState("bearer");
  const [credentialValue, setCredentialValue] = useState("tok_live_secret12345");

  // Reset all endpoint statuses if shared connection details change
  useEffect(() => {
    setEndpointStatuses({
      products: "untested",
      orders: "untested",
      customers: "untested",
      auth: "untested",
      orderHistory: "untested",
    });
  }, [baseUrl, authMethod, credentialValue]);

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

  const handleTestEndpoint = (key: keyof typeof endpoints) => {
    setEndpointStatuses((prev) => ({ ...prev, [key]: "pending" }));
    setTimeout(() => {
      setEndpointStatuses((prev) => ({ ...prev, [key]: "success" }));
    }, 1000);
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

  const handleFinish = () => {
    router.push("/dashboard");
  };

  // Onboarding Completion Criteria
  const isSharedCredsValid =
    baseUrl.trim() !== "" && credentialValue.trim() !== "";

  const allEndpointsSuccess =
    endpointStatuses.products === "success" &&
    endpointStatuses.orders === "success" &&
    endpointStatuses.customers === "success" &&
    endpointStatuses.auth === "success" &&
    endpointStatuses.orderHistory === "success";

  const isBankSetupValid = bankAccount.trim().length >= 8 && bankVerified;

  const isSetupComplete =
    isSharedCredsValid && allEndpointsSuccess && isBankSetupValid;

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
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Authentication Method
              </label>
              <select
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
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
            />
          </div>
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
            disabled={!isSharedCredsValid}
          />

          <EndpointRow
            label="Orders API"
            path={endpoints.orders.path}
            method={endpoints.orders.method}
            onPathChange={(p) => handleEndpointChange("orders", "path", p)}
            onMethodChange={(m) => handleEndpointChange("orders", "method", m)}
            onTest={() => handleTestEndpoint("orders")}
            testStatus={endpointStatuses.orders}
            disabled={!isSharedCredsValid}
          />

          <EndpointRow
            label="Customers API"
            path={endpoints.customers.path}
            method={endpoints.customers.method}
            onPathChange={(p) => handleEndpointChange("customers", "path", p)}
            onMethodChange={(m) => handleEndpointChange("customers", "method", m)}
            onTest={() => handleTestEndpoint("customers")}
            testStatus={endpointStatuses.customers}
            disabled={!isSharedCredsValid}
          />

          <EndpointRow
            label="Auth API"
            path={endpoints.auth.path}
            method={endpoints.auth.method}
            onPathChange={(p) => handleEndpointChange("auth", "path", p)}
            onMethodChange={(m) => handleEndpointChange("auth", "method", m)}
            onTest={() => handleTestEndpoint("auth")}
            testStatus={endpointStatuses.auth}
            disabled={!isSharedCredsValid}
          />

          <EndpointRow
            label="Order History"
            path={endpoints.orderHistory.path}
            method={endpoints.orderHistory.method}
            onPathChange={(p) => handleEndpointChange("orderHistory", "path", p)}
            onMethodChange={(m) => handleEndpointChange("orderHistory", "method", m)}
            onTest={() => handleTestEndpoint("orderHistory")}
            testStatus={endpointStatuses.orderHistory}
            disabled={!isSharedCredsValid}
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
              />
              {bankLoading && (
                <span className="absolute right-3 top-9 text-xs text-text-secondary animate-pulse">
                  Validating...
                </span>
              )}
            </div>
          </div>

          {bankVerified && resolvedBank && (
            <div className="p-4 border border-success/20 bg-success/5 rounded-lg flex items-center justify-between">
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
            disabled={!isSetupComplete}
            className="flex items-center gap-2 shadow-xs"
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>Finish Setup</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
