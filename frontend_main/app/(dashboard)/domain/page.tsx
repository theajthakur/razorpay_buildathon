"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Globe,
  Plus,
  RefreshCw,
  Compass,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { fetchOnboardingDetails, OnboardingResponse } from "@/lib/api/onboarding";
import { listDomains, DomainResponse } from "@/lib/api/domain";
import { ReusableSkeleton, DomainPageSkeleton } from "@/components/ui/Skeleton";
import { DomainList } from "@/components/domain/DomainList";
import { DomainAddModal } from "@/components/domain/DomainAddModal";
import { DomainDeleteModal } from "@/components/domain/DomainDeleteModal";

export default function DomainPage() {
  const [onboarding, setOnboarding] = useState<OnboardingResponse | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  const [domains, setDomains] = useState<DomainResponse[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Check onboarding status
  const checkOnboarding = useCallback(async () => {
    setOnboardingLoading(true);
    try {
      const data = await fetchOnboardingDetails();
      setOnboarding(data);
    } catch (err) {
      console.error("Failed to fetch onboarding status:", err);
      setOnboarding(null);
    } finally {
      setOnboardingLoading(false);
    }
  }, []);

  // Fetch domain list
  const fetchDomains = useCallback(async () => {
    setDomainsLoading(true);
    try {
      const res = await listDomains();
      setDomains(res.domains || []);
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    } finally {
      setDomainsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkOnboarding();
    fetchDomains();
  }, [checkOnboarding, fetchDomains]);

  // Handlers for modal actions
  const handleDomainAdded = (newDomain: DomainResponse) => {
    setDomains((prev) => [newDomain, ...prev]);
  };

  const handleDomainVerified = (updatedDomain: DomainResponse) => {
    setDomains((prev) =>
      prev.map((d) => (d.id === updatedDomain.id ? updatedDomain : d))
    );
  };

  const handleDomainDeleted = (deletedId: string) => {
    setDomains((prev) => prev.filter((d) => d.id !== deletedId));
  };

  const isLoading = onboardingLoading || domainsLoading;

  return (
    <ReusableSkeleton
      name="domain-page"
      loading={isLoading}
      fallback={<DomainPageSkeleton />}
    >
      {/* Onboarding Completion Guard: User must complete onboarding first */}
      {!onboarding ? (
        <div className="max-w-3xl mx-auto py-12 px-4 font-sans">
          <Card className="p-8 sm:p-12 text-center space-y-6 border border-border bg-surface shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-warning/10 text-warning mx-auto flex items-center justify-center">
              <Compass className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                Onboarding Required
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Custom domain configuration connects your storefront URL directly to ShopAgent. Please complete your store onboarding setup first to unlock domain mapping.
              </p>
            </div>

            <div className="pt-2">
              <Link href="/onboarding">
                <Button className="gap-2 px-6 py-2.5 text-sm font-semibold">
                  <span>Complete Onboarding First</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        /* Full-fledged Domain Management Dashboard */
        <div className="space-y-8 max-w-5xl mx-auto font-sans">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
            <div>
              <h1 className="font-heading text-2xl font-bold text-text-primary">
                Custom Domain Management
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Configure custom domain routing, Vercel SSL certificates, and DNS verification for your ShopAgent storefront.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  checkOnboarding();
                  fetchDomains();
                }}
                className="gap-2 text-xs border border-border bg-surface"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </Button>

              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="gap-2 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Domain</span>
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">
                  Total Custom Domains
                </span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Globe className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="font-heading text-2xl font-bold text-text-primary">
                  {domains.length}
                </h3>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">
                  Active & Verified
                </span>
                <div className="p-2 rounded-xl bg-success/10 text-success">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="font-heading text-2xl font-bold text-success">
                  {domains.filter((d) => d.status === "ACTIVE").length}
                </h3>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">
                  Pending Verification
                </span>
                <div className="p-2 rounded-xl bg-warning/10 text-warning">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="font-heading text-2xl font-bold text-warning">
                  {domains.filter((d) => d.status === "PENDING").length}
                </h3>
              </div>
            </Card>
          </div>

          {/* Main Content: Domain List */}
          <Card
            title="Connected Domains"
            description="Active subdomains and custom hostnames assigned to your storefront."
          >
            <DomainList
              domains={domains}
              onVerifySuccess={handleDomainVerified}
              onDeleteTrigger={(id, name) => setDeleteTarget({ id, name })}
            />
          </Card>

          {/* Add Domain Modal */}
          <DomainAddModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSuccess={handleDomainAdded}
          />

          {/* Delete Domain Confirmation Modal */}
          <DomainDeleteModal
            isOpen={!!deleteTarget}
            domainId={deleteTarget?.id || null}
            domainName={deleteTarget?.name || null}
            onClose={() => setDeleteTarget(null)}
            onSuccess={handleDomainDeleted}
          />
        </div>
      )}
    </ReusableSkeleton>
  );
}
