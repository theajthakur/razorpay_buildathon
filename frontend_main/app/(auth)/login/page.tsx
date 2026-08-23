"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { loginUser } from "@/lib/api/auth";

export default function LoginPage() {
  const { signIn } = useSignIn();
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);
  
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
    if (!password) {
      setError("Please enter your password.");
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

  const handleGoogleLogin = async () => {
    if (!signIn) return;
    try {
      setLoading(true);
      setError("");
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err: any) {
      setError(err.message || "An error occurred during Google sign-in.");
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
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                disabled={loading}
              />

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !signIn}>
                {loading ? "Signing In..." : "Sign In"}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-2 text-text-secondary">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={handleGoogleLogin}
                className="w-full border border-border flex items-center justify-center gap-2 hover:bg-background/50 cursor-pointer"
                disabled={loading || !signIn}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Google
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
