"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !email || !password) {
      setError("Please fill out all fields.");
      return;
    }
    // Mock successful sign-up, route to onboarding
    router.push("/onboarding");
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
            Create Merchant Account
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Start powering your store with AI shopping agents
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-surface border border-border rounded-xl p-8 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-primary-light border border-border text-xs text-error">
                {error}
              </div>
            )}

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
            />

            <Input
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              required
            />

            <Button type="submit" variant="primary" size="lg" className="w-full">
              Get Started
            </Button>
          </form>

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
