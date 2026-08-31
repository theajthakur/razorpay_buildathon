"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { fetchCurrentUser, logoutUser, syncAndProvisionUser } from "@/lib/api/auth";

interface MerchantAuthGuardProps {
  children: React.ReactNode;
}

export function MerchantAuthGuard({ children }: MerchantAuthGuardProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isMismatch, setIsMismatch] = useState(false);
  const isHandlingMismatch = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      setIsVerifying(false);
      return;
    }

    let isMounted = true;

    async function checkLocalDbUser() {
      try {
        setIsVerifying(true);
        // Look up corresponding user record in local DB by Clerk User ID
        await fetchCurrentUser();
        
        if (isMounted) {
          console.log(`[AuthSync] Local DB record verified and in sync for Clerk ID: ${user?.id}`);
          setIsVerifying(false);
          setIsMismatch(false);
        }
      } catch (err: any) {
        if (!isMounted) return;

        const isUserNotFound404 =
          err.response?.status === 404 ||
          err.response?.data?.detail === "user_not_found";

        if (isUserNotFound404 && user) {
          console.log(`[AuthSync] User missing from local DB for Clerk ID: ${user.id}. Attempting automatic provisioning...`);
          
          try {
            // Attempt transparent auto-provisioning before treating as unresolvable mismatch
            await syncAndProvisionUser(user);
            // Retry fetching user after provisioning
            await fetchCurrentUser();
            
            if (isMounted) {
              console.log(`[AuthSync] User auto-provisioned and verified successfully for Clerk ID: ${user.id}`);
              setIsVerifying(false);
              setIsMismatch(false);
              return;
            }
          } catch (provisionErr) {
            console.error("[AuthSync] Auto-provisioning attempt failed:", provisionErr);
          }

          // If auto-provisioning also failed, then treat as invalid session state and auto-logout
          console.warn(
            `[AuthSync] Mismatch unresolvable: Clerk user is signed in (${user.id}) but local DB user creation failed.`
          );

          if (!isHandlingMismatch.current) {
            isHandlingMismatch.current = true;
            setIsMismatch(true);
            setIsVerifying(false);

            console.log("[AuthSync] Triggering auto-logout from Clerk and redirecting to /login...");
            
            try {
              // 1. Clear local auth credentials
              logoutUser();
              // 2. Sign out of Clerk session
              await signOut();
            } catch (signOutErr) {
              console.error("[AuthSync] Error during auto-logout:", signOutErr);
            } finally {
              // 3. Force clean page navigation to /login page
              window.location.href = "/login";
            }
          }
        } else {
          // For non-404 errors (e.g. temporary server glitch), do NOT force auto-logout
          console.error("[AuthSync] Error verifying local DB user profile:", err);
          setIsVerifying(false);
        }
      }
    }

    checkLocalDbUser();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, isSignedIn, user, signOut]);

  if (!isLoaded || isVerifying || isMismatch) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-text-secondary">
            {isMismatch
              ? "Invalid session detected. Redirecting to login..."
              : "Verifying merchant authentication..."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default MerchantAuthGuard;
