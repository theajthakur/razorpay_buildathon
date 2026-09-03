"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useBranding } from "@/lib/context/BrandingContext";
import { ChatInput } from "./ChatInput";
import apiClient from "@/lib/api/client";
import { useAuth } from "@/lib/context/AuthContext";
import { LogIn } from "lucide-react";
import { LoginModal } from "./LoginModal";

export default function ChatEmptyState() {
  const { branding, primaryColor } = useBranding();
  const { isAuthenticated } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const router = useRouter();

  const handleStartConversation = async () => {
    if (!inputValue.trim()) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      // 1. Call the backend conversations endpoint
      const response = await apiClient.post<{ conversation_id: string }>("/agentic/conversations");
      const conversationId = response.data.conversation_id;

      // 2. Save the initial user message text in sessionStorage keyed by conversation_id
      sessionStorage.setItem(`pending_message_${conversationId}`, inputValue.trim());

      // 3. Navigate to /chats/[uuid]
      router.push(`/chats/${conversationId}`);
    } catch (err: any) {
      console.error("Failed to start conversation:", err);
      setErrorMsg(err.message || "Failed to establish a new chat. Please try logging in.");
      setIsLoading(false);
    }
  };

  const displayName = branding?.display_name || "Ponion";

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 w-full max-w-4xl mx-auto min-h-[70vh] font-sans">
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md w-full">
        {/* Pulsing/animated Logo Icon */}
        <div
          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-xs border border-secondary-100 p-2 overflow-hidden"
        >
          {(() => {
            const logo = branding?.logo_url || undefined;
            return logo ? (
              <img
                src={logo}
                alt={displayName}
                className="w-14 h-14 object-contain"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-9 h-9"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            );
          })()}
        </div>

        {/* Greeting Message */}
        <h2 className="text-3xl font-extrabold text-secondary-900 tracking-tight mb-4 font-sans leading-tight">
          Hi! What are you looking for today?
        </h2>

        <p className="text-secondary-500 text-sm leading-relaxed mb-8 max-w-sm">
          Ask me about products, specify your choices, customize details, or let me guide you to the perfect selection.
        </p>

        {errorMsg && (
          <div className="mb-4 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 px-3 py-2 rounded-xl w-full">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Action container docked below greeting */}
      <div className="w-full max-w-xl">
        {isAuthenticated ? (
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleStartConversation}
            isLoading={isLoading}
            placeholder="Ask something to start a new chat..."
          />
        ) : (
          <div className="flex flex-col items-center space-y-3 text-center w-full">
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm shadow-md hover:brightness-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to {displayName}</span>
            </button>
            <p className="text-xs text-secondary-400 font-medium">
              Please sign in to start a new conversation and view recommendations.
            </p>
          </div>
        )}
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}
