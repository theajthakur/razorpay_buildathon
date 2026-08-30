"use client";

import React from "react";
import { Package, ShoppingBag, Clock, CheckCircle2, Truck, AlertCircle, XCircle } from "lucide-react";

export interface OrderItem {
  order_id: string;
  status: string;
  total: number | string;
  created_at: string;
  items?: any[];
  [key: string]: any;
}

interface OrderHistoryCardProps {
  orders?: OrderItem[];
  count?: number;
}

export function OrderHistoryCard({ orders = [], count }: OrderHistoryCardProps) {
  const totalCount = count !== undefined ? count : orders.length;

  // Empty state
  if (!orders || orders.length === 0 || totalCount === 0) {
    return (
      <div className="mt-3 w-full max-w-sm rounded-2xl border border-secondary-200 bg-white p-4 text-center select-none font-sans shadow-xs">
        <div className="w-10 h-10 rounded-full bg-secondary-100 text-secondary-500 flex items-center justify-center mx-auto mb-2">
          <Package className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-secondary-900">No orders yet</h4>
        <p className="text-xs text-secondary-500 mt-0.5">
          Your past and active orders will appear here once placed.
        </p>
      </div>
    );
  }

  const visibleOrders = orders.slice(0, 5);

  const getStatusBadge = (statusStr: string) => {
    const s = (statusStr || "").toLowerCase();

    if (s.includes("deliver") || s.includes("complet")) {
      return {
        label: statusStr || "Delivered",
        icon: <CheckCircle2 className="w-3 h-3" />,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200"
      };
    }
    if (s.includes("ship") || s.includes("transit") || s.includes("dispatch")) {
      return {
        label: statusStr || "Shipped",
        icon: <Truck className="w-3 h-3" />,
        className: "bg-sky-50 text-sky-700 border-sky-200"
      };
    }
    if (s.includes("cancel") || s.includes("fail") || s.includes("return")) {
      return {
        label: statusStr || "Cancelled",
        icon: <XCircle className="w-3 h-3" />,
        className: "bg-rose-50 text-rose-700 border-rose-200"
      };
    }
    // Pending / Processing / Awaiting Payment / Initiated
    return {
      label: statusStr || "Processing",
      icon: <Clock className="w-3 h-3" />,
      className: "bg-amber-50 text-amber-700 border-amber-200"
    };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "N/A") return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const formatPrice = (val: number | string) => {
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return "₹0";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="mt-3 w-full max-w-sm rounded-2xl border border-secondary-200 bg-white p-4 shadow-xs select-none font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-secondary-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-secondary-900">Recent Orders</h4>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-700 text-xs font-semibold">
          {totalCount} {totalCount === 1 ? "order" : "orders"}
        </span>
      </div>

      {/* Order List */}
      <div className="divide-y divide-secondary-100">
        {visibleOrders.map((order, idx) => {
          const badge = getStatusBadge(order.status);
          const formattedDate = formatDate(order.created_at);
          const displayId = order.order_id ? `#${order.order_id.replace(/^#/, "")}` : `#ord_${idx + 1}`;

          return (
            <div key={order.order_id || idx} className="py-2.5 first:pt-2.5 last:pb-0 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-secondary-900 font-mono">
                  {displayId}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}>
                  {badge.icon}
                  {badge.label}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-secondary-500">
                <span className="font-semibold text-secondary-800">
                  {formatPrice(order.total)}
                </span>
                {formattedDate && (
                  <span className="text-[11px] text-secondary-400">
                    {formattedDate}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint if truncated */}
      {totalCount > 5 && (
        <div className="mt-3 pt-2 border-t border-secondary-100 text-center text-[11px] text-secondary-400 font-medium">
          Showing 5 most recent of {totalCount} orders
        </div>
      )}
    </div>
  );
}

export default OrderHistoryCard;
