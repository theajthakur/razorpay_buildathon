"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useBranding } from "@/lib/context/BrandingContext";
import { ChatInput } from "./ChatInput";
import apiClient from "@/lib/api/client";

export default function ChatEmptyState() {
  const { branding, primaryColor } = useBranding();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 w-full max-w-4xl mx-auto min-h-[70vh] font-sans">
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md w-full">
        {/* Pulsing/animated Logo Icon */}
        <div
          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-xs border border-secondary-100"
        >
          {(() => {
            const logo = branding?.logo_url || undefined;
            const display = branding?.display_name || undefined;
            return logo ? (
              <img
                src={logo}
                alt={display}
                className="w-12 h-12 object-contain"
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
          Ask me about dishes, specify dietary choices, customize ingredients, or let me guide you to the perfect meal.
        </p>

        {errorMsg && (
          <div className="mb-4 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 px-3 py-2 rounded-xl w-full">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Input container docked below greeting */}
      <div className="w-full max-w-3xl">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleStartConversation}
          isLoading={isLoading}
          placeholder="Ask something to start a new chat..."
        />
      </div>
    </div>
  );
}
