"use client";

import React, { useEffect, Suspense } from "react";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

/**
 * Inner component that handles the SSO callback with search params
 */
function SSOCallbackContent() {
  const { userId, isLoaded } = useAuth();
  const searchParams = useSearchParams();

  // Retrieve redirect URL from query params if present
  const redirectUrl = searchParams.get("redirect_url") || "";

  useEffect(() => {
    if (isLoaded && userId && typeof window !== "undefined") {
      localStorage.setItem("clerk_user_id", userId);
    }
  }, [isLoaded, userId]);

  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={redirectUrl || "/dashboard"}
      signUpForceRedirectUrl={redirectUrl || "/onboarding"}
      /**
       * When Clerk sign-up requires additional info (e.g. username is required),
       * route the user back into our app instead of Clerk-hosted completion UI.
       */
      continueSignUpUrl="/onboarding"
    />
  );
}

/**
 * SSO Callback page for handling OAuth redirects from Clerk
 */
export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Clerk CAPTCHA widget container for bot protection during OAuth flow */}
      <div id="clerk-captcha"></div>
      
      <div className="text-center space-y-4 mb-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-text-secondary">Completing secure sign-in...</p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <SSOCallbackContent />
      </Suspense>
    </div>
  );
}
