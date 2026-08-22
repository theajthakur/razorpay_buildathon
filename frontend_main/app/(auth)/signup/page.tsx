"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { loginUser, syncClerkUser } from "@/lib/api/auth";

export default function SignupPage() {
  const { signUp } = useSignUp();

  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Verification flow state
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    if (!storeName || !email) {
      setError("Please fill out all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let result;
      // 1. Create signup using password strategy if password is supplied, otherwise fallback to passwordless
      if (password) {
        result = await signUp.password({
          emailAddress: email,
          password,
        });
      } else {
        result = await signUp.create({
          emailAddress: email,
        });
      }

      if (result.error) {
        setError(result.error.message || "Sign up failed.");
        return;
      }

      // 2. Start email OTP verification code delivery
      const sendResult = await signUp.verifications.sendEmailCode();
      if (sendResult.error) {
        setError(sendResult.error.message || "Failed to send verification email.");
        return;
      }

      setVerifying(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    if (!code) {
      setError("Please enter the verification code sent to your email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 3. Attempt verification code challenge
      const verifyResult = await signUp.verifications.verifyEmailCode({
        code,
      });

      if (verifyResult.error) {
        setError(verifyResult.error.message || "Invalid verification code.");
        return;
      }

      if (signUp.status === "complete") {
        // 4. Convert completed signup into an active session
        const finalizeResult = await signUp.finalize();
        if (finalizeResult.error) {
          setError(finalizeResult.error.message || "Failed to activate session.");
          return;
        }

        if (signUp.createdUserId) {
          // Log User ID to local storage for Axios header use
          loginUser(signUp.createdUserId);

          // Direct Sync: Trigger backend database record creation immediately
          try {
            await syncClerkUser({
              id: signUp.createdUserId,
              email_addresses: [{ email_address: email }],
              first_name: storeName,
              last_name: "",
            });
          } catch (syncErr) {
            console.error("Direct backend sync failed: ", syncErr);
          }
        }

        // Use window.location.href to bypass Next.js middleware cookie race conditions
        window.location.href = "/onboarding";
      } else {
        setError("Verification incomplete. Additional steps needed.");
      }
    } catch (err: any) {
      setError(err.message || "Invalid verification code.");
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
            {verifying ? "Verify Your Email" : "Create Merchant Account"}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {verifying
              ? `Enter the code sent to ${email}`
              : "Start powering your store with AI shopping agents"}
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
            // Signup Credentials Form
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Store Name"
                type="text"
                placeholder="Acme Electronics"
                value={storeName}
                onChange={(e) => {
                  setStoreName(e.target.value);
                  setError("");
                }}
                required
                disabled={loading}
              />

              <Input
                label="Business Email"
                type="email"
                placeholder="merchant@acme.com"
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
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                disabled={loading}
                helperText="If your Clerk settings require passwords, enter one here."
              />

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !signUp}>
                {loading ? "Creating Account..." : "Get Started"}
              </Button>
            </form>
          ) : (
            // Email Verification Code Form
            <form onSubmit={handleVerify} className="space-y-5">
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

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !signUp}>
                {loading ? "Verifying..." : "Verify Code"}
              </Button>

              <button
                type="button"
                onClick={() => setVerifying(false)}
                className="w-full text-center text-xs text-text-secondary hover:text-primary mt-2 font-medium"
                disabled={loading}
              >
                Back to Sign Up
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-text-secondary">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:text-primary-hover"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
