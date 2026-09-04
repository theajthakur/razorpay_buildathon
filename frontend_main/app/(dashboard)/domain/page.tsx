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
        <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 font-sans">
          <Card className="p-6 sm:p-12 text-center space-y-6 border border-border bg-surface shadow-lg max-w-2xl mx-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-warning/10 text-warning mx-auto flex items-center justify-center shrink-0">
              <Compass className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto min-w-0">
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-text-primary">
                Onboarding Required
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Custom domain configuration connects your storefront URL directly to ShopAgent. Please complete your store onboarding setup first to unlock domain mapping.
              </p>
            </div>

            <div className="pt-2">
              <Link href="/onboarding" className="inline-block w-full sm:w-auto">
                <Button className="gap-2 px-6 py-2.5 text-sm font-semibold w-full sm:w-auto justify-center">
                  <span>Complete Onboarding First</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        /* Full-fledged Domain Management Dashboard */
        <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto font-sans w-full min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6 min-w-0">
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-text-primary">
                Custom Domain Management
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
                Configure custom domain routing, Vercel SSL certificates, and DNS verification for your ShopAgent storefront.
              </p>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
              <Button
                variant="ghost"
                onClick={() => {
                  checkOnboarding();
                  fetchDomains();
                }}
                className="gap-2 text-xs border border-border bg-surface flex-1 sm:flex-initial justify-center whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Refresh</span>
              </Button>

              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="gap-2 text-xs flex-1 sm:flex-initial justify-center whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add Custom Domain</span>
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-semibold text-text-secondary min-w-0 truncate">
                  Total Custom Domains
                </span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="font-heading text-2xl font-bold text-text-primary">
                  {domains.length}
                </h3>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-semibold text-text-secondary min-w-0 truncate">
                  Active & Verified
                </span>
                <div className="p-2 rounded-xl bg-success/10 text-success shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="font-heading text-2xl font-bold text-success">
                  {domains.filter((d) => d.status === "ACTIVE").length}
                </h3>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-semibold text-text-secondary min-w-0 truncate">
                  Pending Verification
                </span>
                <div className="p-2 rounded-xl bg-warning/10 text-warning shrink-0">
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
