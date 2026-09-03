"use client";

import React, { useState } from "react";
import { useRazorpayScript } from "@/lib/hooks/useRazorpayScript";
import { useBranding } from "@/lib/context/BrandingContext";
import apiClient from "@/lib/api/client";
import { CreditCard, CheckCircle2, AlertCircle, Loader2, ShoppingBag, RotateCcw } from "lucide-react";

interface OrderConfirmationCardProps {
  metadata?: {
    agent_order_id?: string;
    merchant_order_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    payment_id?: string;
    amount?: number;
    currency?: string;
    key_id?: string;
    payment_status?: string;
    failure_reason?: string;
    [key: string]: any;
  };
  onSendMessage?: (msg: string) => void;
}

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

function sanitizeFailureReason(reason?: string): string {
  if (!reason) return "We couldn't complete your payment. Please try retrying below.";
  const rLower = reason.toLowerCase();
  if (
    rLower.includes("exception") ||
    rLower.includes("traceback") ||
    rLower.includes("500") ||
    rLower.includes("internal_error") ||
    rLower.includes("sqlalchemy")
  ) {
    return "The payment service encountered a temporary error. You can retry your payment safely.";
  }
  if (rLower.includes("razorpay_error:")) {
    return reason.replace(/razorpay_error:\s*/i, "");
  }
  return reason;
}

export default function OrderConfirmationCard({ metadata, onSendMessage }: OrderConfirmationCardProps) {
  const { loaded, failed } = useRazorpayScript();
  const { branding, primaryColor } = useBranding();
  
  const [paying, setPaying] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(
    metadata?.razorpay_payment_id || metadata?.payment_id || null
  );
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const razorpayOrderId = metadata?.razorpay_order_id;
  const amount = metadata?.amount || 0;
  const currency = (metadata?.currency || "INR").toUpperCase();
  const merchantOrderId = metadata?.merchant_order_id || metadata?.agent_order_id;
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || metadata?.key_id || "";

  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
  }).format(amount);

  // Authoritative Status Determination
  const rawStatus = localStatus || metadata?.payment_status;

  let effectiveStatus = "unknown";
  if (rawStatus === "payment_captured" || metadata?.payment_id || metadata?.razorpay_payment_id || paymentId) {
    effectiveStatus = "payment_captured";
  } else if (rawStatus === "awaiting_payment") {
    effectiveStatus = "awaiting_payment";
  } else if (rawStatus === "failed") {
    effectiveStatus = "failed";
  } else if (metadata?.action === "initiate_payment" && !rawStatus) {
    effectiveStatus = "awaiting_payment";
  } else if (rawStatus) {
    effectiveStatus = rawStatus;
  }

  const handlePayNow = () => {
    if (!window.Razorpay) {
      setPaymentError("Payment widget is not loaded yet. Please refresh and try again.");
      return;
    }
    if (!razorpayOrderId) {
      setPaymentError("Order ID is missing. Cannot initiate payment.");
      return;
    }

    setPaying(true);
    setPaymentError(null);

    const options = {
      key: keyId,
      amount: Math.round(amount * 100), // paise
      currency,
      order_id: razorpayOrderId,
      name: branding?.display_name || "Merchant Store",
      description: `Order #${merchantOrderId || ""}`,
      image: branding?.logo_url || undefined,
      theme: {
        color: primaryColor || "#4338CA"
      },
      handler: async (response: RazorpayHandlerResponse) => {
        try {
          // Verify payment signature with backend
          const res = await apiClient.post("/agentic/payments/verify", {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });

          setLocalStatus("payment_captured");
          setPaymentId(response.razorpay_payment_id || res.data?.razorpay_payment_id);
          setPaymentError(null);
        } catch (e: any) {
          console.error("Payment verification failed:", e);
          const detail = e.response?.data?.detail;
          if (detail === "signature_verification_failed") {
            setPaymentError("Payment signature verification failed. Please contact support.");
          } else {
            setPaymentError("Payment went through, but we couldn't confirm it on our end. Please contact support with your payment ID.");
          }
        } finally {
          setPaying(false);
        }
      },
      modal: {
        ondismiss: () => {
          setPaying(false);
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      
      rzp.on("payment.failed", (response: any) => {
        setPaying(false);
        const desc = response.error?.description || "Transaction failed. Please try again.";
        setPaymentError(`Payment failed: ${desc}`);
        setLocalStatus("failed");
      });

      rzp.open();
    } catch (err: any) {
      setPaying(false);
      setPaymentError(`Failed to launch payment widget: ${err.message || "Unknown error"}`);
    }
  };

  const handleRetryPayment = async () => {
    setRetrying(true);
    setPaymentError(null);
    try {
      if (onSendMessage) {
        onSendMessage(`Retry payment for order #${merchantOrderId || metadata?.agent_order_id || ""}`);
      } else {
        const resp = await apiClient.post("/agentic/payments/retry", {
          agent_order_id: metadata?.agent_order_id
        });
        if (resp.data?.payment_status) {
          setLocalStatus(resp.data.payment_status);
        }
      }
    } catch (err: any) {
      console.error("Retry payment failed:", err);
      setPaymentError("Unable to retry payment. Please try again in a moment.");
    } finally {
      setRetrying(false);
    }
  };

  if (failed) {
    return (
      <div className="mt-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Couldn't load payment widget. Please refresh and try again.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full bg-white rounded-xl border border-secondary-200 shadow-sm overflow-hidden text-secondary-900">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-secondary-50 border-b border-secondary-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-secondary-600" />
          <span className="text-xs font-semibold text-secondary-800">Order Summary</span>
        </div>
        <span className="text-[11px] font-mono text-secondary-500 font-medium">
          #{merchantOrderId ? merchantOrderId.substring(0, 14) : "—"}
        </span>
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-secondary-500 font-medium">Total Amount</span>
          <span className="text-base font-bold text-secondary-900">{formattedPrice}</span>
        </div>

        {effectiveStatus === "payment_captured" ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold">Payment Successful ✓</span>
              <span className="text-[11px] text-emerald-700 font-medium">
                {formattedPrice} paid successfully
              </span>
              {paymentId && (
                <span className="text-[10px] text-emerald-600 font-mono">
                  Ref: {paymentId}
                </span>
              )}
            </div>
          </div>
        ) : effectiveStatus === "awaiting_payment" ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePayNow}
              disabled={!loaded || paying}
              style={!loaded || paying ? undefined : { backgroundColor: primaryColor }}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs text-white flex items-center justify-center gap-2 transition-all shadow-xs ${
                !loaded || paying
                  ? "bg-secondary-300 cursor-not-allowed text-secondary-500"
                  : "hover:opacity-95 active:scale-[0.99] cursor-pointer"
              }`}
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Payment…</span>
                </>
              ) : !loaded ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Razorpay…</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pay Now — {formattedPrice}</span>
                </>
              )}
            </button>
          </div>
        ) : effectiveStatus === "failed" ? (
          <div className="flex flex-col gap-2.5">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-800">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-red-900">Payment Failed</span>
                <span className="text-red-700 leading-snug">
                  {sanitizeFailureReason(metadata?.failure_reason || paymentError || undefined)}
                </span>
              </div>
            </div>
            <button
              onClick={handleRetryPayment}
              disabled={retrying}
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs bg-secondary-900 text-white flex items-center justify-center gap-2 hover:bg-secondary-800 active:scale-[0.99] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {retrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Retrying Payment…</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry Payment</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-3 bg-secondary-50 border border-secondary-200 rounded-lg flex items-center gap-2 text-secondary-700 text-xs font-medium">
            <Loader2 className="w-4 h-4 text-secondary-400 animate-spin shrink-0" />
            <span>Payment Status: Checking current payment status…</span>
          </div>
        )}

        {paymentError && effectiveStatus !== "failed" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-snug">{paymentError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
