import React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageSquare, IndianRupee, ArrowUpRight, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const activities = [
    {
      id: 1,
      type: "order",
      title: "Order #1024 placed via Agent",
      time: "12 mins ago",
      amount: "₹1,499.00",
      customer: "Amit Sharma",
    },
    {
      id: 2,
      type: "chat",
      title: "New chat session started",
      time: "25 mins ago",
      amount: null,
      customer: "Preeti Patel",
    },
    {
      id: 3,
      type: "order",
      title: "Order #1023 placed via Agent",
      time: "1 hour ago",
      amount: "₹4,290.00",
      customer: "Rajesh Kumar",
    },
    {
      id: 4,
      type: "sync",
      title: "Catalog catalog sync complete",
      time: "4 hours ago",
      amount: null,
      customer: "System",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            Store Performance Overview
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Track metrics and sales driven by your AI shopping assistants.
          </p>
        </div>
        <Button variant="primary" className="self-start sm:self-auto gap-2 shadow-xs">
          <span>Sync Catalog Now</span>
          <ArrowUpRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-secondary">
              Revenue via Agent
            </span>
            <div className="p-2 rounded-lg bg-primary-light text-primary">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-heading text-3xl font-bold text-text-primary">
              ₹45,290.00
            </h3>
            <p className="text-xs text-success font-semibold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+14.2% since yesterday</span>
            </p>
          </div>
        </Card>

        {/* Metric 2 */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-secondary">
              Total Agent Orders
            </span>
            <div className="p-2 rounded-lg bg-primary-light text-primary">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-heading text-3xl font-bold text-text-primary">
              28 orders
            </h3>
            <p className="text-xs text-text-secondary flex items-center gap-1 mt-1">
              <span>Avg. Cart: ₹1,617.50</span>
            </p>
          </div>
        </Card>

        {/* Metric 3 */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-secondary">
              Active Conversations
            </span>
            <div className="p-2 rounded-lg bg-primary-light text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-heading text-3xl font-bold text-text-primary">
              6 shoppers
            </h3>
            <p className="text-xs text-success font-semibold flex items-center gap-1 mt-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse inline-block mr-1" />
              <span>Agents responding live</span>
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Activity List */}
      <Card
        title="Recent Activity Feed"
        description="Real-time log of purchases, chats, and automated system synchronization."
        action={<Button variant="ghost" className="text-sm">View Archive</Button>}
      >
        <div className="divide-y divide-border">
          {activities.map((act) => (
            <div
              key={act.id}
              className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg shrink-0 ${
                  act.type === "order"
                    ? "bg-success/10 text-success"
                    : act.type === "chat"
                    ? "bg-primary-light text-primary"
                    : "bg-secondary/5 text-text-secondary"
                }`}>
                  {act.type === "order" ? (
                    <ShoppingBag className="w-4 h-4" />
                  ) : act.type === "chat" ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <Settings2Icon className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {act.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Customer: <span className="font-medium text-text-primary">{act.customer}</span> &bull; {act.time}
                  </p>
                </div>
              </div>

              {act.amount && (
                <div className="text-right">
                  <span className="text-sm font-bold text-text-primary font-mono">
                    {act.amount}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Simple local fallback for lucide icon
function Settings2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="12" r="3" />
      <circle cx="7" cy="12" r="3" />
    </svg>
  );
}
