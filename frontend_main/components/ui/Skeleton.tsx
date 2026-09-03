"use client";

import React from "react";
import { Skeleton as BoneyardSkeleton } from "boneyard-js/react";

export interface DashboardCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className = "" }: DashboardCardSkeletonProps) {
  return (
    <div className={`p-6 rounded-2xl border border-border bg-surface space-y-4 animate-pulse ${className}`}>
      <div className="flex items-center justify-between">
        <div className="h-4 bg-border/60 rounded-md w-28" />
        <div className="w-9 h-9 rounded-xl bg-border/40" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-8 bg-border/80 rounded-md w-36" />
        <div className="h-3.5 bg-border/50 rounded-md w-24" />
      </div>
    </div>
  );
}

export function ActivityFeedSkeleton({ className = "" }: DashboardCardSkeletonProps) {
  return (
    <div className={`p-6 rounded-2xl border border-border bg-surface space-y-6 ${className}`}>
      <div className="space-y-2 border-b border-border pb-4">
        <div className="h-5 bg-border/80 rounded-md w-40" />
        <div className="h-3.5 bg-border/50 rounded-md w-64" />
      </div>
      <div className="divide-y divide-border">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between animate-pulse gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-border/50 shrink-0" />
              <div className="space-y-2">
                <div className="h-4 bg-border/70 rounded-md w-44 sm:w-56" />
                <div className="h-3 bg-border/40 rounded-md w-32 sm:w-40" />
              </div>
            </div>
            <div className="h-4 bg-border/60 rounded-md w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4 animate-pulse">
      {/* Title Header Skeleton */}
      <div className="space-y-2">
        <div className="h-7 bg-border/80 rounded-md w-48" />
        <div className="h-4 bg-border/50 rounded-md w-96" />
      </div>

      {/* Card 1: General Settings Skeleton */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-4">
        <div className="h-5 bg-border/70 rounded-md w-36" />
        <div className="h-3.5 bg-border/40 rounded-md w-72" />
        <div className="space-y-2 pt-2 max-w-lg">
          <div className="h-4 bg-border/50 rounded-md w-32" />
          <div className="h-10 bg-border/60 rounded-xl w-full" />
        </div>
      </div>

      {/* Card 2: Capabilities & Behavior Skeleton */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-4">
        <div className="h-5 bg-border/70 rounded-md w-44" />
        <div className="h-3.5 bg-border/40 rounded-md w-80" />
        <div className="divide-y divide-border pt-2 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between pt-3 first:pt-0">
              <div className="space-y-1.5">
                <div className="h-4 bg-border/70 rounded-md w-40" />
                <div className="h-3 bg-border/40 rounded-md w-64" />
              </div>
              <div className="w-11 h-6 rounded-full bg-border/60 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Card 3: Payment & Security Limits Skeleton */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-4">
        <div className="h-5 bg-border/70 rounded-md w-52" />
        <div className="h-3.5 bg-border/40 rounded-md w-80" />
        <div className="space-y-2 pt-2 max-w-lg">
          <div className="h-4 bg-border/50 rounded-md w-56" />
          <div className="h-10 bg-border/60 rounded-xl w-full" />
        </div>
      </div>
    </div>
  );
}

export function OnboardingPageSkeleton() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4 px-4 sm:px-6 font-sans animate-pulse">
      {/* Title Header Skeleton */}
      <div className="space-y-2 border-b border-border pb-4">
        <div className="h-7 bg-border/80 rounded-md w-64" />
        <div className="h-4 bg-border/50 rounded-md max-w-xl w-full" />
      </div>

      {/* Section 1: Shared Connection Details Card Skeleton */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="h-5 bg-border/80 rounded-md w-52" />
          <div className="h-4 bg-border/40 rounded-md w-24" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-border/50 rounded-md w-28" />
            <div className="h-10 bg-border/60 rounded-xl w-full" />
          </div>

          <div className="p-4 bg-background border border-border rounded-xl flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-4 bg-border/70 rounded-md w-48" />
              <div className="h-3 bg-border/40 rounded-md w-72" />
            </div>
            <div className="w-11 h-6 rounded-full bg-border/60 shrink-0" />
          </div>
        </div>
      </div>

      {/* Section 2: Resource Endpoints Card Skeleton */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="h-5 bg-border/80 rounded-md w-44" />
          <div className="h-4 bg-border/40 rounded-md w-24" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border border-border bg-background p-5 rounded-xl space-y-4">
              <div className="space-y-2">
                <div className="h-4 bg-border/70 rounded-md w-32" />
                <div className="h-5 bg-border/40 rounded-md w-20" />
                <div className="h-3 bg-border/40 rounded-md w-24" />
              </div>
              <div className="h-9 bg-border/60 rounded-xl w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface ReusableSkeletonProps {
  loading: boolean;
  fallback: React.ReactNode;
  children: React.ReactNode;
  name?: string;
}

export function ReusableSkeleton({ loading, fallback, children, name }: ReusableSkeletonProps) {
  return (
    <BoneyardSkeleton loading={loading} fallback={fallback} name={name} animate="pulse" transition>
      {children}
    </BoneyardSkeleton>
  );
}
