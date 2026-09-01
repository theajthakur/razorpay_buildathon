"use client";

import React, { useState } from "react";
import { useRazorpayScript } from "@/lib/hooks/useRazorpayScript";
import { useBranding } from "@/lib/context/BrandingContext";
import apiClient from "@/lib/api/client";
import { CreditCard, CheckCircle2, AlertCircle, Loader2, ShoppingBag } from "lucide-react";

interface OrderConfirmationCardProps {
  metadata?: {
    agent_order_id?: string;
    merchant_order_id?: string;
    razorpay_order_id?: string;
    amount?: number;
    currency?: string;
    key_id?: string;
    [key: string]: any;
  };
}

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export default function OrderConfirmationCard({ metadata }: OrderConfirmationCardProps) {
  const { loaded, failed } = useRazorpayScript();
  const { branding, primaryColor } = useBranding();
  
  const [paying, setPaying] = useState(false);
  const [paymentCaptured, setPaymentCaptured] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
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
          await apiClient.post("/agentic/payments/verify", {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });

          setPaymentCaptured(true);
          setPaymentId(response.razorpay_payment_id);
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
          setPaying(false); // Customer closed checkout without paying — safe no-op
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      
      rzp.on("payment.failed", (response: any) => {
        setPaying(false);
        const desc = response.error?.description || "Transaction failed. Please try again.";
        setPaymentError(`Payment failed: ${desc}`);
      });

      rzp.open();
    } catch (err: any) {
      setPaying(false);
      setPaymentError(`Failed to launch payment widget: ${err.message || "Unknown error"}`);
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

        {paymentCaptured ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold">Payment Successful ✓</span>
              <span className="text-[11px] text-emerald-700 font-mono">
                Payment ID: {paymentId}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={handlePayNow}
            disabled={!loaded || paying}
            style={!loaded || paying ? undefined : { backgroundColor: primaryColor }}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs text-white flex items-center justify-center gap-2 transition-all shadow-xs ${
              !loaded || paying
                ? "bg-secondary-300 cursor-not-allowed text-secondary-500"
                : "hover:opacity-95 active:scale-[0.99]"
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
        )}

        {paymentError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-snug">{paymentError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
