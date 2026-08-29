"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import apiClient from "@/lib/api/client";

interface AuthContextType {
  token: string | null;
  email: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (token: string, email: string, expiresAt: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for saved session
    const storedToken = localStorage.getItem("shop_agent_token");
    const storedEmail = localStorage.getItem("shop_agent_email");
    const storedExpiresAt = localStorage.getItem("shop_agent_expires_at");

    if (storedToken && storedExpiresAt) {
      const expiry = new Date(storedExpiresAt);
      if (expiry > new Date()) {
        setToken(storedToken);
        setEmail(storedEmail);
        setExpiresAt(storedExpiresAt);
        setIsAuthenticated(true);
      } else {
        // Clear expired session values
        localStorage.removeItem("shop_agent_token");
        localStorage.removeItem("shop_agent_email");
        localStorage.removeItem("shop_agent_expires_at");
      }
    }
    setAuthLoading(false);
  }, []);

  const login = (newToken: string, newEmail: string, newExpiresAt: string) => {
    localStorage.setItem("shop_agent_token", newToken);
    localStorage.setItem("shop_agent_email", newEmail);
    localStorage.setItem("shop_agent_expires_at", newExpiresAt);
    
    setToken(newToken);
    setEmail(newEmail);
    setExpiresAt(newExpiresAt);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      // Outgoing HTTP request interceptor handles Bearer token attachment automatically
      await apiClient.post("/agentic/auth/logout");
    } catch (err) {
      console.warn("Server-side logout call failed or was already expired:", err);
    } finally {
      localStorage.removeItem("shop_agent_token");
      localStorage.removeItem("shop_agent_email");
      localStorage.removeItem("shop_agent_expires_at");
      
      setToken(null);
      setEmail(null);
      setExpiresAt(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ token, email, expiresAt, isAuthenticated, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
