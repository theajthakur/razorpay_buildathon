"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  MessageSquare,
  IndianRupee,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Activity
} from "lucide-react";
import {
  getAnalyticsSummary,
  getRecentActivity,
  AnalyticsSummary,
  ActivityItem
} from "@/lib/api/analytics";
import {
  ReusableSkeleton,
  MetricCardSkeleton,
  ActivityFeedSkeleton
} from "@/components/ui/Skeleton";

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);
  const [activityLoading, setActivityLoading] = useState<boolean>(true);

  // Independent fetch function for Analytics Summary
  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const data = await getAnalyticsSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to fetch analytics summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Independent fetch function for Recent Activity Feed
  const fetchActivity = async () => {
    setActivityLoading(true);
    try {
      const data = await getRecentActivity();
      setActivities(data.activities || []);
    } catch (err) {
      console.error("Failed to fetch recent activity:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    // Both endpoints are dispatched independently
    fetchSummary();
    fetchActivity();
  }, []);

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            Store Performance Overview
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Track metrics and sales driven by your AI shopping assistants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              fetchSummary();
              fetchActivity();
            }}
            className="gap-2 text-xs border border-border bg-surface"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Grid of Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Metric 1: Revenue via Agent */}
        <ReusableSkeleton
          name="revenue-card"
          loading={summaryLoading}
          fallback={<MetricCardSkeleton />}
        >
          <Card className="h-full flex flex-col justify-between py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">
                Revenue via Agent
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="font-heading text-3xl font-bold text-text-primary">
                {summary?.revenue?.total ?? "₹0.00"}
              </h3>
              <p className="text-xs text-success font-semibold flex items-center gap-1 mt-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{summary?.revenue?.relative_yesterday ?? "+0.0%"} vs yesterday</span>
              </p>
            </div>
          </Card>
        </ReusableSkeleton>

        {/* Metric 2: Total Agent Orders */}
        <ReusableSkeleton
          name="orders-card"
          loading={summaryLoading}
          fallback={<MetricCardSkeleton />}
        >
          <Card className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">
                Total Agent Orders
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-heading text-3xl font-bold text-text-primary">
                {summary?.orders?.total_count ?? "0"} orders
              </h3>
              <p className="text-xs text-text-secondary flex items-center gap-1 mt-1 font-medium">
                <span>Avg. Cart: ₹{summary?.orders?.average_cart_value ?? "0"}</span>
              </p>
            </div>
          </Card>
        </ReusableSkeleton>

        {/* Metric 3: Active Conversations */}
        <ReusableSkeleton
          name="conversations-card"
          loading={summaryLoading}
          fallback={<MetricCardSkeleton />}
        >
          <Card className="sm:col-span-2 lg:col-span-1 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">
                Total Conversations
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-heading text-3xl font-bold text-text-primary">
                {summary?.conversations?.total ?? "0"}
              </h3>
              <p className="text-xs text-text-secondary flex items-center gap-1 mt-1 font-medium">
                <span>Avg. per user: {summary?.conversations?.average_per_user ?? "0"} chats</span>
              </p>
            </div>
          </Card>
        </ReusableSkeleton>
      </div>

      {/* Recent Activity Feed */}
      <ReusableSkeleton
        name="activity-feed"
        loading={activityLoading}
        fallback={<ActivityFeedSkeleton />}
      >
        <Card
          title="Recent Activity Feed"
          description="Real-time log of purchases, chats, and automated system synchronization."
        >
          {activities.length > 0 ? (
            <div className="divide-y divide-border">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${act.type === "order"
                        ? "bg-success/10 text-success"
                        : act.type === "chat"
                          ? "bg-primary/10 text-primary"
                          : "bg-surface border border-border text-text-secondary"
                        }`}
                    >
                      {act.type === "order" ? (
                        <ShoppingBag className="w-4 h-4" />
                      ) : act.type === "chat" ? (
                        <MessageSquare className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-text-primary font-heading">
                        {act.title}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5 font-sans">
                        {act.subtitle}
                      </p>
                    </div>
                  </div>

                  {act.amount && (
                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-text-primary font-mono">
                        {act.amount}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-text-secondary border border-dashed border-border rounded-xl bg-surface/50">
              No recent activity recorded yet. Activity will stream here live as customers interact with your agent.
            </div>
          )}
        </Card>
      </ReusableSkeleton>
    </div>
  );
}
