"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Menu, X, Plus, MessageSquare, Calendar, ChevronRight, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { BrandingProvider, useBranding } from "@/lib/context/BrandingContext";
import { AuthProvider, useAuth } from "@/lib/context/AuthContext";
import apiClient from "@/lib/api/client";
import { LoginButton } from "../common/LoginButton";
import { LoginModal } from "../chat/LoginModal";
import { ScrollArea } from "../common/ScrollArea";

interface AppShellProps {
  children: React.ReactNode;
}

const MOCK_CHATS = [
  { id: "returning-user", title: "Spicy Paneer Tikka Wrap Combo", date: "Today, 1:24 PM" },
  { id: "2a73e99b-859f-477d-5736-d01fa3829bf2", title: "Double Cheese Margherita Pizza", date: "Yesterday, 8:45 PM" },
  { id: "3f829bf2-d01f-477d-859f-2a73e99b859f", title: "Superfood Avocado Salad", date: "2 days ago" },
];

function formatConvoDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  } catch (_) {
    return "";
  }
}

function AppShellContent({ children }: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState("");
  const { branding, brandingLoading, brandingError, primaryColor } = useBranding();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<{ id: string; title: string; date: string }[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  // Synchronize activeChatId automatically with URL path changes
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/chats\/([^\/]+)/);
      if (match) {
        setActiveChatId(match[1]);
      } else {
        setActiveChatId("");
      }
    }
  }, [pathname]);

  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      return;
    }
    try {
      const resp = await apiClient.get<{ conversations: any[] }>("/agentic/conversations");
      const list = resp.data.conversations.map((c: any) => ({
        id: c.id,
        title: c.title || "Untitled",
        date: formatConvoDate(c.created_at)
      }));
      setConversations(list);
    } catch (err) {
      console.error("Failed to load conversations list:", err);
      setConversations([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const handleTitleUpdate = (e: Event) => {
      const { id, title } = (e as CustomEvent).detail;
      setConversations(prev => {
        const exists = prev.some(c => c.id === id);
        if (exists) {
          return prev.map(c => c.id === id ? { ...c, title } : c);
        } else {
          return [
            { id, title, date: "Just now" },
            ...prev
          ];
        }
      });
    };
    window.addEventListener("conversation_title_updated", handleTitleUpdate);
    return () => window.removeEventListener("conversation_title_updated", handleTitleUpdate);
  }, []);

  // Sync logoUrl when branding loads or changes
  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logo_url ?? null);
    } else {
      setLogoUrl(null);
    }
  }, [branding]);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setIsMobileSidebarOpen(false); // Close drawer on mobile
    router.push(`/chats/${id}`);
  };

  // Reusable dynamic logo rendering block with skeletons
  const renderLogoSection = () => {
    if (brandingLoading) {
      return (
        <div className="flex items-center gap-2.5 animate-pulse select-none" data-testid="branding-skeleton">
          <div className="w-9 h-9 rounded-xl bg-secondary-200" />
          <div className="h-4.5 w-24 bg-secondary-200 rounded-md" />
        </div>
      );
    }

    const hasLogo = !!logoUrl;
    return (
      <div className="flex items-center gap-2.5 select-none">
        {hasLogo ? (
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0">
            <img
              src={logoUrl!}
              alt={branding?.display_name || "Merchant Logo"}
              className="w-full h-full object-cover"
              onError={() => {
                // Remove broken logo image state to fallback to standard onion SVG
                setLogoUrl(null);
              }}
            />
          </div>
        ) : (
          <div
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M12 2C8.5 6.5 5.5 9.5 5.5 13.5a6.5 6.5 0 0 0 13 0c0-4-3-7-6.5-11.5z" />
              <path d="M12 5.5c-2.2 3.2-3.8 5.8-3.8 8a3.8 3.8 0 0 0 7.6 0c0-2.2-1.6-4.8-3.8-8z" />
            </svg>
          </div>
        )}
        <span className="text-lg font-bold tracking-tight text-secondary-900 font-sans truncate max-w-[160px]">
          {branding?.display_name || "ShopAgent"}
        </span>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-secondary-200">
      {/* Top Section: Logo */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-secondary-100 shrink-0">
        {renderLogoSection()}
        {/* Mobile close button inside the drawer */}
        <button
          onClick={toggleMobileSidebar}
          className="p-1 rounded-lg text-secondary-500 hover:bg-secondary-100 md:hidden focus:outline-none cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Middle Section: Scrollable Sessions & New Chat */}
      <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
        {/* New Chat Button */}
        <button
          style={{ backgroundColor: primaryColor }}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-white font-semibold text-sm shadow-sm hover:brightness-95 active:brightness-90 transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          onClick={() => {
            router.push("/");
            setIsMobileSidebarOpen(false);
          }}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Chat</span>
        </button>

        {/* Scrollable list of chats */}
        <div className="flex-1 flex flex-col min-h-0 space-y-1.5">
          <div className="flex items-center justify-between px-2 text-[11px] font-bold tracking-wider text-secondary-400 uppercase select-none">
            <span>Recent Chats</span>
            <span>{conversations.length}</span>
          </div>

          <ScrollArea className="flex-1 -mx-2 px-2 py-1 space-y-1">
            {conversations.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`flex flex-col items-start w-full p-3 rounded-xl transition-all duration-200 text-left cursor-pointer group focus:outline-none ${isActive
                    ? "bg-surface-200 text-secondary-900 font-medium"
                    : "hover:bg-background-100 text-secondary-600"
                    }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare
                        style={{ color: isActive ? primaryColor : undefined }}
                        className={`w-4 h-4 shrink-0 transition-colors ${isActive
                          ? ""
                          : "text-secondary-400 group-hover:text-secondary-500"
                          }`}
                      />
                      <span className="text-xs font-semibold truncate w-full">
                        {chat.title}
                      </span>
                    </div>
                    <ChevronRight
                      style={{ color: isActive ? primaryColor : undefined }}
                      className={`w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 ${isActive ? "" : "text-secondary-400"
                        }`}
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-secondary-400 font-medium">
                    <Calendar className="w-3 h-3" />
                    <span>{chat.date}</span>
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </div>
      </div>

      {/* Bottom Section: Profile/Auth */}
      <div className="p-4 border-t border-secondary-100 shrink-0 bg-background-50/50">
        <LoginButton onOpenLogin={() => setIsLoginOpen(true)} />
      </div>
    </div>
  );

  if (brandingLoading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-background-50 font-sans select-none">
        <Loader2 className="w-9 h-9 text-secondary-500 animate-spin mb-3" />
        <span className="text-xs text-secondary-500 font-semibold tracking-tight">
          Loading store configuration...
        </span>
      </div>
    );
  }

  if (brandingError || !branding) {
    const currentHost = typeof window !== "undefined" ? window.location.host : "this domain";

    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center p-6 bg-background-50 font-sans select-none text-center">
        <div className="bg-white border border-secondary-200 shadow-xl rounded-2xl p-8 max-w-md w-full space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-secondary-900 tracking-tight font-sans">
              Domain Mapping Not Found
            </h2>
            <p className="text-xs text-secondary-500 leading-relaxed px-2">
              No active ShopAgent AI store configuration found for <code className="bg-secondary-100 text-secondary-800 px-2 py-0.5 rounded font-mono text-[11px] font-semibold">{currentHost}</code>.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href="https://shopagent.vijstack.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <span>Turn Your E-Commerce Store Into An AI Agent</span>
            </a>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl bg-secondary-100 text-secondary-700 hover:bg-secondary-200 font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background-50 text-secondary-900 font-sans">
      {/* 1. Backdrop for mobile sidebar drawer */}
      {isAuthenticated && isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-secondary-950/40 backdrop-blur-xs md:hidden transition-opacity duration-300"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* 2. Left Sidebar (Drawer on mobile, static on desktop - hidden when unauthenticated) */}
      {isAuthenticated && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 md:w-80 shrink-0 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          {sidebarContent}
        </aside>
      )}

      {/* 3. Right Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-4 bg-white border-b border-secondary-200 md:hidden shrink-0">
          {isAuthenticated ? (
            <button
              onClick={toggleMobileSidebar}
              className="p-2 rounded-xl text-secondary-600 hover:bg-secondary-100 focus:outline-none cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}
          <div className="flex-1 flex justify-center">
            {renderLogoSection()}
          </div>
          <div className="w-10 h-10 flex justify-end items-center">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsLoginOpen(true)}
                style={{ backgroundColor: primaryColor }}
                className="px-3 py-1.5 rounded-lg text-white font-semibold text-xs transition-all hover:brightness-95 cursor-pointer shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col min-w-0 bg-background-50">
          <div className="flex-1 h-full w-full relative flex flex-col overflow-hidden">
            {children}
          </div>
        </main>
      </div>
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <BrandingProvider>
      <AuthProvider>
        <AppShellContent>{children}</AppShellContent>
      </AuthProvider>
    </BrandingProvider>
  );
}
