"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { Check, Settings, UploadCloud, Sliders, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMerchantSettings,
  updateMerchantSettings,
  getPresignedLogoUrl,
  uploadFileToS3,
} from "@/lib/api/settings";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";

export default function SettingsPage() {
  // Initial database values for dirty checking
  const [initialSettings, setInitialSettings] = useState<{
    agentName: string;
    agentColor: string;
    confirmationLimit: number;
    logoUrl: string;
    toggles: {
      historyLookup: boolean;
      cartNegotiation: boolean;
      autoCoupons: boolean;
      smartUpsell: boolean;
    };
  } | null>(null);

  // Agent configuration states
  const [agentName, setAgentName] = useState("Acme Shopping Assistant");
  const [agentColor, setAgentColor] = useState("#4338CA");
  const [confirmationLimit, setConfirmationLimit] = useState(5000);
  const [logoUrl, setLogoUrl] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // States for Image Cropper modal & upload retry resilience
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Toggles state
  const [toggles, setToggles] = useState({
    historyLookup: true,
    cartNegotiation: true,
    autoCoupons: false,
    smartUpsell: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const data = await fetchMerchantSettings();

        const name = data.display_name || "Acme Shopping Assistant";
        const color = data.brand_color || "#4338CA";
        const limit = data.confirmation_limit ?? 5000;
        const logo = data.logo_url || "";
        const loadedToggles = {
          historyLookup: data.toggles?.historyLookup ?? true,
          cartNegotiation: data.toggles?.cartNegotiation ?? true,
          autoCoupons: data.toggles?.autoCoupons ?? false,
          smartUpsell: data.toggles?.smartUpsell ?? true,
        };

        setAgentName(name);
        setAgentColor(color);
        setConfirmationLimit(limit);
        setLogoUrl(logo);
        setToggles(loadedToggles);

        setInitialSettings({
          agentName: name,
          agentColor: color,
          confirmationLimit: limit,
          logoUrl: logo,
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

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validations
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Unsupported file type. Please select a PNG, JPEG, WEBP, or SVG image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSizeBytes) {
      toast.error("File is too large. Logos must be smaller than 2MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setIsCropperOpen(true);
  };

  const uploadCroppedBlob = async (blob: Blob) => {
    try {
      setIsUploading(true);
      setUploadError(null);

      const fileType = blob.type || "image/png";
      const originalName = selectedFile?.name || "logo.png";
      const dotIndex = originalName.lastIndexOf(".");
      const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
      const ext = fileType === "image/jpeg" ? "jpeg" : fileType.split("/")[1] || "png";
      const fileName = `${baseName}_cropped.${ext}`;

      toast.info("Requesting upload signature...");
      const presignData = await getPresignedLogoUrl(fileName, fileType);

      toast.info("Uploading logo to S3...");
      const uploadFile = new File([blob], fileName, { type: fileType });
      await uploadFileToS3(presignData.uploadUrl, uploadFile, fileType);

      setLogoUrl(presignData.publicUrl);
      setCroppedBlob(null); // Clear retry state
      toast.success("Logo uploaded successfully! Click 'Save Settings' to commit changes.");
    } catch (err: any) {
      console.error("Logo upload error:", err);
      setUploadError("Upload failed");
      setCroppedBlob(blob); // Save blob for retry
      if (err.response && err.response.config && err.response.config.url?.includes("s3.amazonaws.com")) {
        toast.error("Failed to upload logo to S3. Direct bucket access failed.");
      } else {
        toast.error(err.response?.data?.detail || "Failed to generate presigned upload signature.");
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCropComplete = async (blob: Blob) => {
    setIsCropperOpen(false);
    await uploadCroppedBlob(blob);
  };

  const handleCropCancel = () => {
    setIsCropperOpen(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Hex color regex validation
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(agentColor)) {
      toast.error("Accent Color must be a valid hex string starting with # (e.g. #4F46E5).");
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateMerchantSettings({
        display_name: agentName,
        brand_color: agentColor,
        confirmation_limit: confirmationLimit,
        logo_url: logoUrl,
        toggles: toggles,
      });

      const name = updated.display_name || "Acme Shopping Assistant";
      const color = updated.brand_color || "#4338CA";
      const limit = updated.confirmation_limit ?? 5000;
      const logo = updated.logo_url || "";
      const loadedToggles = {
        historyLookup: updated.toggles?.historyLookup ?? true,
        cartNegotiation: updated.toggles?.cartNegotiation ?? true,
        autoCoupons: updated.toggles?.autoCoupons ?? false,
        smartUpsell: updated.toggles?.smartUpsell ?? true,
      };

      setAgentName(name);
      setAgentColor(color);
      setConfirmationLimit(limit);
      setLogoUrl(logo);
      setToggles(loadedToggles);

      setInitialSettings({
        agentName: name,
        agentColor: color,
        confirmationLimit: limit,
        logoUrl: logo,
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
    agentColor !== initialSettings.agentColor ||
    confirmationLimit !== initialSettings.confirmationLimit ||
    logoUrl !== initialSettings.logoUrl ||
    toggles.historyLookup !== initialSettings.toggles.historyLookup ||
    toggles.cartNegotiation !== initialSettings.toggles.cartNegotiation ||
    toggles.autoCoupons !== initialSettings.toggles.autoCoupons ||
    toggles.smartUpsell !== initialSettings.toggles.smartUpsell
  ) : false;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-text-secondary">Loading agent settings...</p>
      </div>
    );
  }

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

        {/* Unsaved changes alert */}
        {isDirty && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center gap-2 text-sm font-medium transition-all">
            <AlertTriangle className="w-5 h-5" />
            <span>You have unsaved changes. Please make sure to save before leaving.</span>
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

            {/* Avatar Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Agent Widget Logo
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoSelect}
                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                className="hidden"
              />
              <div className="flex items-center gap-4">
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`relative w-16 h-16 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center text-text-secondary hover:text-primary hover:border-primary transition-colors cursor-pointer overflow-hidden ${isUploading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  ) : logoUrl ? (
                    <>
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold">
                        Change
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6" />
                      <span className="text-[10px] font-semibold mt-1">Upload</span>
                    </>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {logoUrl ? "Custom Logo Active" : "Default Avatar Active"}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Supports PNG, JPG, WEBP, or SVG. Max size 2MB.
                  </p>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl("");
                        setCroppedBlob(null);
                        setUploadError(null);
                      }}
                      className="text-xs text-red-500 hover:underline mt-1 font-medium block text-left"
                    >
                      Remove Logo
                    </button>
                  )}
                  {croppedBlob && uploadError && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-red-500 font-medium">Upload failed.</span>
                      <button
                        type="button"
                        onClick={() => uploadCroppedBlob(croppedBlob)}
                        disabled={isUploading}
                        className="text-xs text-primary hover:underline font-bold"
                      >
                        {isUploading ? "Uploading..." : "Retry Upload"}
                      </button>
                    </div>
                  )}
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

      <ImageCropperModal
        open={isCropperOpen}
        file={selectedFile}
        aspectRatio={1}
        maxOutputSize={512}
        onCancel={handleCropCancel}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
