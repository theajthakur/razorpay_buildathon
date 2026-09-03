"use client";

import React from "react";
import { ShoppingBag, Clock, CheckCircle2, Truck, XCircle } from "lucide-react";

export interface OrderItem {
  id?: string;
  name?: string;
  price?: number | string;
  quantity?: number | string;
  status?: string;
  [key: string]: any;
}

interface OrderHistoryCardProps {
  orders?: OrderItem[];
  count?: number;
}

function formatStatus(statusStr?: string): string {
  if (!statusStr || typeof statusStr !== "string") return "";
  const s = statusStr.toLowerCase().replace(/_/g, " ").trim();
  if (s === "pending") return "Pending";
  if (s === "awaiting payment" || s === "awaiting_payment") return "Awaiting payment";
  if (s === "payment captured" || s === "payment_captured") return "Payment captured";
  if (s === "failed") return "Failed";
  if (s === "delivered" || s === "completed") return "Delivered";
  if (s === "shipped" || s === "in transit" || s === "in_transit") return "Shipped";
  if (s === "cancelled" || s === "canceled") return "Cancelled";

  // Capitalize words for custom statuses
  return s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function getStatusBadge(statusStr?: string) {
  const s = (statusStr || "").toLowerCase();

  if (s.includes("deliver") || s.includes("complet")) {
    return {
      icon: <CheckCircle2 className="w-3 h-3" />,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };
  }
  if (s.includes("ship") || s.includes("transit") || s.includes("dispatch")) {
    return {
      icon: <Truck className="w-3 h-3" />,
      className: "bg-sky-50 text-sky-700 border-sky-200"
    };
  }
  if (s.includes("cancel") || s.includes("fail") || s.includes("return")) {
    return {
      icon: <XCircle className="w-3 h-3" />,
      className: "bg-rose-50 text-rose-700 border-rose-200"
    };
  }
  return {
    icon: <Clock className="w-3 h-3" />,
    className: "bg-amber-50 text-amber-700 border-amber-200"
  };
}

function formatPrice(val: any): string | null {
  if (val === undefined || val === null || val === "") return null;
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
    .format(num)
    .replace(/\.00$/, "");
}

export function OrderHistoryCard({ orders = [], count }: OrderHistoryCardProps) {
  const totalCount = count !== undefined ? count : orders.length;

  if (!orders || orders.length === 0 || totalCount === 0) {
    return (
      <div className="mt-3 w-full max-w-sm rounded-2xl border border-secondary-200 bg-white p-4 text-center select-none font-sans shadow-xs">
        <div className="w-10 h-10 rounded-full bg-secondary-100 text-secondary-500 flex items-center justify-center mx-auto mb-2">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-secondary-900">No orders found</h4>
        <p className="text-xs text-secondary-500 mt-0.5">
          Your order history will appear here once orders are placed.
        </p>
      </div>
    );
  }

  const visibleOrders = orders.slice(0, 5);

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
          const name = order.name || order.product_name || order.title;
          const formattedPrice = formatPrice(order.price ?? order.total);
          const quantity = order.quantity ?? order.qty;
          const statusText = formatStatus(order.status);
          const badge = getStatusBadge(order.status);

          // Additional merchant configured fields (excluding standard internal keys)
          const standardKeys = new Set([
            "id", "name", "price", "quantity", "status", "created_at",
            "items", "order_id", "_id", "total", "qty", "product_name", "title"
          ]);
          const additionalEntries = Object.entries(order).filter(
            ([k, v]) => !standardKeys.has(k) && v !== null && v !== undefined && v !== ""
          );

          // Construct price x quantity string if available
          const priceQtyParts: string[] = [];
          if (formattedPrice) priceQtyParts.push(formattedPrice);
          if (quantity !== undefined && quantity !== null && quantity !== "") {
            priceQtyParts.push(`× ${quantity}`);
          }
          const priceQtyString = priceQtyParts.join(" ");

          return (
            <div key={order.id || order.order_id || idx} className="py-3 first:pt-3 last:pb-0 flex flex-col gap-1.5">
              {/* Top Row: Name & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  {name && (
                    <span className="text-xs font-bold text-secondary-900 truncate">
                      {name}
                    </span>
                  )}

                  {/* Price x Quantity Line */}
                  {priceQtyString && (
                    <span className="text-xs font-semibold text-secondary-600 mt-0.5">
                      {priceQtyString}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                {statusText && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${badge.className}`}>
                    {badge.icon}
                    {statusText}
                  </span>
                )}
              </div>

              {/* Additional Configured Fields */}
              {additionalEntries.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {additionalEntries.map(([k, v]) => (
                    <span key={k} className="text-[10px] text-secondary-500 bg-secondary-100 px-2 py-0.5 rounded font-mono">
                      {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalCount > 5 && (
        <div className="mt-3 pt-2 border-t border-secondary-100 text-center text-[11px] text-secondary-400 font-medium">
          Showing 5 most recent of {totalCount} orders
        </div>
      )}
    </div>
  );
}

export default OrderHistoryCard;
