"use client";

import React from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-text-secondary">Completing secure sign-in...</p>
      </div>
      <AuthenticateWithRedirectCallback 
        signUpForceRedirectUrl="/onboarding" 
        signInForceRedirectUrl="/dashboard" 
      />
    </div>
  );
}
