"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { loginUser } from "@/lib/api/auth";

export default function LoginPage() {
  const { signIn } = useSignIn();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Initialize sign in with the user's email
      const result = await signIn.create({
        identifier: email,
      });

      if (result.error) {
        setError(result.error.message || "Failed to initiate sign in.");
        return;
      }

      // Check if password strategy is supported/required for this user
      const hasPasswordFactor = signIn.supportedFirstFactors?.some(
        (f) => f.strategy === "password"
      );

      if (hasPasswordFactor && password) {
        // Attempt signing in directly with password
        const passwordResult = await signIn.password({
          password,
        });

        if (passwordResult.error) {
          setError(passwordResult.error.message || "Invalid password.");
          return;
        }

        if (signIn.status === "complete") {
          const finalizeResult = await signIn.finalize();
          if (finalizeResult.error) {
            setError(finalizeResult.error.message || "Failed to activate session.");
            return;
          }

          if (signIn.id) {
            loginUser(signIn.id);
          }
          window.location.href = "/dashboard";
          return;
        }
      }

      // 2. Request and send email OTP code (fallback or primary verification factor)
      const sendResult = await signIn.emailCode.sendCode();
      if (sendResult.error) {
        setError(sendResult.error.message || "Failed to send verification code.");
        return;
      }

      setVerifying(true);
    } catch (err: any) {
      setError(err.message || "An error occurred while sending the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    if (!code) {
      setError("Please enter the verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 3. Verify the OTP code
      const verifyResult = await signIn.emailCode.verifyCode({
        code,
      });

      if (verifyResult.error) {
        setError(verifyResult.error.message || "Invalid verification code.");
        return;
      }

      if (signIn.status === "complete") {
        // 4. Finalize session and set it as active
        const finalizeResult = await signIn.finalize();
        if (finalizeResult.error) {
          setError(finalizeResult.error.message || "Failed to activate session.");
          return;
        }

        // Save Clerk ID in localStorage for dynamic Axios Bearer headers
        if (signIn.id) {
          loginUser(signIn.id);
        }

        // Use window.location.href to bypass Next.js middleware cookie race conditions
        window.location.href = "/dashboard";
      } else {
        setError("Sign in incomplete. Additional verification steps required.");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed. Please check the code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-text-on-primary font-heading font-bold text-2xl mb-3">
            M
          </div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            {verifying ? "Enter Verification Code" : "Sign in to Merchant OS"}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {verifying
              ? `We sent a one-time code to ${email}`
              : "Access your AI shopping agent merchant dashboard"}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-surface border border-border rounded-xl p-8 shadow-xs">
          {error && (
            <div className="p-3 rounded-lg bg-primary-light border border-border text-xs text-error mb-5">
              {error}
            </div>
          )}

          {!verifying ? (
            // Email & Password Input Form
            <form onSubmit={handleSendCode} className="space-y-5">
              <Input
                label="Business Email"
                type="email"
                placeholder="merchant@store.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                required
                disabled={loading}
              />

              <Input
                label="Password (Optional)"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                disabled={loading}
                helperText="Provide password if configured, or leave blank to authenticate via Email OTP."
              />

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !signIn}>
                {loading ? "Sending Code..." : "Continue"}
              </Button>
            </form>
          ) : (
            // Verification OTP Code Form
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <Input
                label="Verification Code"
                type="text"
                placeholder="e.g. 123456"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                required
                disabled={loading}
              />

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !signIn}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>

              <button
                type="button"
                onClick={() => setVerifying(false)}
                className="w-full text-center text-xs text-text-secondary hover:text-primary mt-2 font-medium"
                disabled={loading}
              >
                Back to Sign In
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-text-secondary">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-primary hover:text-primary-hover"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
