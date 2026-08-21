"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ConnectionForm, ConnectionData } from "@/components/ui/ConnectionForm";
import { StatusBadge, StatusType } from "@/components/ui/StatusBadge";
import { Globe, Settings2, Key, Database, BadgeCheck, CreditCard, ArrowRight, ArrowLeft, Landmark } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [formData, setFormData] = useState<{
    products: ConnectionData;
    orders: ConnectionData;
    customers: ConnectionData;
    auth: ConnectionData;
  }>({
    products: { baseUrl: "", authMethod: "apikey", credentialValue: "" },
    orders: { baseUrl: "", authMethod: "bearer", credentialValue: "" },
    customers: { baseUrl: "", authMethod: "apikey", credentialValue: "" },
    auth: { baseUrl: "", authMethod: "bearer", credentialValue: "" },
  });

  // Bank connection details state
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [ifscError, setIfscError] = useState("");
  const [resolvedBank, setResolvedBank] = useState("");
  const [resolvedBranch, setResolvedBranch] = useState("");
  const [razorpayConnected, setRazorpayConnected] = useState(false);
  const [razorpayTesting, setRazorpayTesting] = useState(false);

  // Connection status states
  const [testStatuses, setTestStatuses] = useState<{
    products: StatusType;
    orders: StatusType;
    customers: StatusType;
    auth: StatusType;
  }>({
    products: "untested",
    orders: "untested",
    customers: "untested",
    auth: "untested",
  });

  const steps = [
    "Products API",
    "Orders API",
    "Customers API",
    "Auth API",
    "Settlement Account",
    "Review & Complete",
  ];

  const handleFormChange = (
    apiKey: "products" | "orders" | "customers" | "auth",
    updated: Partial<ConnectionData>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [apiKey]: { ...prev[apiKey], ...updated },
    }));
    setTestStatuses((prev) => ({
      ...prev,
      [apiKey]: "untested",
    }));
  };

  const simulateTestConnection = (
    apiKey: "products" | "orders" | "customers" | "auth"
  ) => {
    setTestStatuses((prev) => ({ ...prev, [apiKey]: "pending" }));
    setTimeout(() => {
      setTestStatuses((prev) => ({ ...prev, [apiKey]: "success" }));
    }, 1000);
  };

  const handleIfscLookup = async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    setIfsc(cleaned);
    
    // Clear resolved bank and connection state if user modifies code away from 11 chars
    if (cleaned.length !== 11) {
      setResolvedBank("");
      setResolvedBranch("");
      setRazorpayConnected(false);
      setIfscError("");
      return;
    }

    setRazorpayTesting(true);
    setIfscError("");
    
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${cleaned}`);
      if (!res.ok) {
        throw new Error("Invalid IFSC Code");
      }
      const data = await res.json();
      setResolvedBank(data.BANK);
      setResolvedBranch(data.BRANCH);
      setRazorpayConnected(true);
    } catch (err) {
      setIfscError("Failed to detect branch. Please check the IFSC code.");
      setResolvedBank("");
      setResolvedBranch("");
      setRazorpayConnected(false);
    } finally {
      setRazorpayTesting(false);
    }
  };

  const handleFinish = () => {
    router.push("/dashboard");
  };

  const isStep5Valid = bankAccount.trim().length >= 8 && razorpayConnected;

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Page Title Header */}
      <div className="text-center sm:text-left">
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Connect Your Business APIs
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Link your store databases and setup Razorpay payouts for automated payment links.
        </p>
      </div>

      {/* Progress Tracker */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-xs">
        <StepIndicator currentStep={currentStep} steps={steps} />
      </div>

      {/* Wizard Step Render */}
      {currentStep === 1 && (
        <ConnectionForm
          apiName="Products"
          description="Provide access to your product catalog so the AI shopping agent can browse, fetch inventory, and recommend products."
          values={formData.products}
          onChange={(val) => handleFormChange("products", val)}
          onTestConnection={() => simulateTestConnection("products")}
          testStatus={testStatuses.products}
          onNext={() => setCurrentStep(2)}
          isFirstStep
        />
      )}

      {currentStep === 2 && (
        <ConnectionForm
          apiName="Orders"
          description="Provide access to your orders API to allow the AI agent to verify purchase states, create order carts, and lookup history."
          values={formData.orders}
          onChange={(val) => handleFormChange("orders", val)}
          onTestConnection={() => simulateTestConnection("orders")}
          testStatus={testStatuses.orders}
          onNext={() => setCurrentStep(3)}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && (
        <ConnectionForm
          apiName="Customers"
          description="Provide access to customer records so the AI agent can lookup profiles, apply personalized discounts, and check purchase patterns."
          values={formData.customers}
          onChange={(val) => handleFormChange("customers", val)}
          onTestConnection={() => simulateTestConnection("customers")}
          testStatus={testStatuses.customers}
          onNext={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && (
        <ConnectionForm
          apiName="Auth"
          description="Provide authentication endpoints to securely sign in shoppers and scope agent permissions for backend operations."
          values={formData.auth}
          onChange={(val) => handleFormChange("auth", val)}
          onTestConnection={() => simulateTestConnection("auth")}
          testStatus={testStatuses.auth}
          onNext={() => setCurrentStep(5)}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {currentStep === 5 && (
        <Card
          title="Setup Bank Settlement Account"
          description="Provide your business bank details to receive payouts. Razorpay's network maps dynamic checkouts to split client margins directly into this deposit target."
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Number */}
              <Input
                label="Bank Account Number"
                type="text"
                placeholder="09280192839128"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
                required
              />

              {/* IFSC Code */}
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
                {razorpayTesting && (
                  <span className="absolute right-3 top-9 text-xs text-text-secondary animate-pulse">
                    Validating...
                  </span>
                )}
              </div>
            </div>

            {/* Resolved Bank Banner */}
            {razorpayConnected && resolvedBank && (
              <div className="p-4 border border-success/20 bg-success/5 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Landmark className="w-6 h-6 text-success shrink-0" />
                  <div>
                    <p className="font-semibold text-text-primary">
                      {resolvedBank}
                    </p>
                    <p className="text-xs text-text-secondary">
                      Branch: {resolvedBranch} &bull; Route Active
                    </p>
                  </div>
                </div>
                <StatusBadge status="success" message="Branch Detected" />
              </div>
            )}

            {/* Actions Panel */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={() => setCurrentStep(6)}
                disabled={!isStep5Valid}
                className="flex items-center gap-2"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {currentStep === 6 && (
        <Card
          title="Review & Complete Setup"
          description="Review your connected endpoints. All connections must be tested and verified green to proceed."
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Products Summary Card */}
              <div className="p-5 border border-border rounded-xl bg-background flex flex-col justify-between h-40">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary-light text-primary">
                      <Database className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-text-primary">
                        Products API
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[180px]">
                        {formData.products.baseUrl}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={testStatuses.products} />
                </div>
                <div className="text-xs text-text-secondary">
                  Auth Method:{" "}
                  <span className="font-semibold text-text-primary capitalize">
                    {formData.products.authMethod}
                  </span>
                </div>
              </div>

              {/* Orders Summary Card */}
              <div className="p-5 border border-border rounded-xl bg-background flex flex-col justify-between h-40">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary-light text-primary">
                      <Globe className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-text-primary">
                        Orders API
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[180px]">
                        {formData.orders.baseUrl}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={testStatuses.orders} />
                </div>
                <div className="text-xs text-text-secondary">
                  Auth Method:{" "}
                  <span className="font-semibold text-text-primary capitalize">
                    {formData.orders.authMethod}
                  </span>
                </div>
              </div>

              {/* Customers Summary Card */}
              <div className="p-5 border border-border rounded-xl bg-background flex flex-col justify-between h-40">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary-light text-primary">
                      <Settings2 className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-text-primary">
                        Customers API
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[180px]">
                        {formData.customers.baseUrl}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={testStatuses.customers} />
                </div>
                <div className="text-xs text-text-secondary">
                  Auth Method:{" "}
                  <span className="font-semibold text-text-primary capitalize">
                    {formData.customers.authMethod}
                  </span>
                </div>
              </div>

              {/* Auth Summary Card */}
              <div className="p-5 border border-border rounded-xl bg-background flex flex-col justify-between h-40">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary-light text-primary">
                      <Key className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-text-primary">
                        Auth API
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[180px]">
                        {formData.auth.baseUrl}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={testStatuses.auth} />
                </div>
                <div className="text-xs text-text-secondary">
                  Auth Method:{" "}
                  <span className="font-semibold text-text-primary capitalize">
                    {formData.auth.authMethod}
                  </span>
                </div>
              </div>

              {/* Razorpay Summary Card */}
              <div className="p-5 border border-border rounded-xl bg-background flex flex-col justify-between h-40 md:col-span-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary-light text-primary">
                      <CreditCard className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-text-primary">
                        Razorpay Settlement Target
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5">
                        A/C: {bankAccount.replace(/.*(?=.{4})/, "******")} &bull; IFSC: {ifsc}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={razorpayConnected ? "success" : "untested"} message={razorpayConnected ? "Verified" : "Unconnected"} />
                </div>
                <div className="text-xs text-text-secondary flex justify-between">
                  <span>Bank: {resolvedBank} &bull; {resolvedBranch}</span>
                  <span className="text-success font-semibold">Direct Deposit Payout Enabled</span>
                </div>
              </div>
            </div>

            {/* Complete Setup Action Banner */}
            <div className="p-5 border border-success/20 rounded-xl bg-success/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BadgeCheck className="w-8 h-8 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-text-primary">
                    All Connections Verified
                  </p>
                  <p className="text-xs text-text-secondary">
                    Your store APIs and settlement bank account have been validated successfully.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCurrentStep(5)}
                  className="flex items-center gap-2"
                >
                  <span>Edit Setup</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleFinish}
                  className="flex items-center gap-2 shadow-xs"
                >
                  <span>Finish Setup</span>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
