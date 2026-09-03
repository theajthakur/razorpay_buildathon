"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  ChatMessage 
} from "@/lib/mock/chat";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { AlertCircle, Loader2, RefreshCw, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { useBranding } from "@/lib/context/BrandingContext";
import apiClient from "@/lib/api/client";

interface ChatWindowProps {
  conversationId: string;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { isAuthenticated, authLoading, login } = useAuth();
  const { branding, primaryColor } = useBranding();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamingStage, setStreamingStage] = useState<string | null>(null);
  const [streamingLabel, setStreamingLabel] = useState<string | undefined>(undefined);
  const [conversationTitle, setConversationTitle] = useState("Untitled");

  // Inline Login Form state for unauthenticated users visiting /chats/[uuid]
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Validate conversation UUID format or mock string for testing
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidUuid = uuidRegex.test(conversationId) || conversationId === "returning-user";

  const consumeMessageStream = useCallback(async (messageText: string, optimisticUserMsgId: string) => {
    setIsLoading(true);
    setStreamingStage("thinking");
    setStreamingLabel("Thinking…");

    let userMsgId = optimisticUserMsgId;
    let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const token = localStorage.getItem("shop_agent_token");
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      
      const response = await fetch(`${apiBaseUrl}/agentic/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: messageText })
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      streamReader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;

        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          const event = JSON.parse(line);
          if (event.type === "status") {
            setStreamingStage(event.stage);
            setStreamingLabel(event.label);
          } else if (event.type === "title") {
            setConversationTitle(event.title);
            window.dispatchEvent(
              new CustomEvent("conversation_title_updated", {
                detail: { id: conversationId, title: event.title }
              })
            );
          } else if (event.type === "final") {
            const userMsgData = event.user_message;
            const agentMsgData = event.agent_message;

            const finalUserMsg: ChatMessage = {
              id: userMsgData.message_id,
              role: "user",
              content: userMsgData.message,
              createdAt: userMsgData.created_at
            };

            const finalAgentMsg: ChatMessage = {
              id: agentMsgData.message_id,
              role: "assistant",
              content: agentMsgData.message,
              products: agentMsgData.products,
              metadata: agentMsgData.metadata,
              createdAt: agentMsgData.created_at
            };

            setMessages(prev => {
              const updated = prev.map(m => m.id === userMsgId ? finalUserMsg : m);
              if (updated.some(m => m.id === finalAgentMsg.id)) {
                return updated;
              }
              return [...updated, finalAgentMsg];
            });
            userMsgId = finalUserMsg.id;
          }
        }
      }
    } catch (err) {
      console.error("Message stream error:", err);
      setMessages(prev => 
        prev.map(m => m.id === userMsgId ? { ...m, error: true } : m)
      );
    } finally {
      setIsLoading(false);
      setStreamingStage(null);
      if (streamReader) {
        try {
          streamReader.releaseLock();
        } catch (_) {}
      }
    }
  }, [conversationId]);

  const loadConversation = useCallback(async () => {
    // Wait until auth state is known, and don't load if unauthenticated
    if (!isAuthenticated || authLoading) return;

    if (!isValidUuid) {
      router.push("/");
      return;
    }

    setIsHistoryLoading(true);
    setErrorMessage(null);

    let isSubscribed = true;

    try {
      // 1. Check for pending initial message in sessionStorage
      const pendingKey = `pending_message_${conversationId}`;
      const pendingMessageText = sessionStorage.getItem(pendingKey);

      if (pendingMessageText) {
        sessionStorage.removeItem(pendingKey);

        const userMsgId = Math.random().toString(36).substring(2, 15);
        const userMsg: ChatMessage = {
          id: userMsgId,
          role: "user",
          content: pendingMessageText,
          createdAt: new Date().toISOString()
        };

        if (isSubscribed) {
          setMessages([userMsg]);
          setIsHistoryLoading(false);
          await consumeMessageStream(pendingMessageText, userMsgId);
        }
      } else {
        // 2. Otherwise load conversation history from API
        const response = await apiClient.get<{ title: string; messages: any[] }>(
          `/agentic/conversations/${conversationId}/messages`
        );

        if (!isSubscribed) return;

        setConversationTitle(response.data.title || "Untitled");
        const history: ChatMessage[] = (response.data.messages || []).map((m: any) => ({
          id: m.message_id,
          role: m.sender === "agent" ? "assistant" : "user",
          content: m.message,
          products: m.products,
          metadata: m.metadata,
          createdAt: m.created_at
        }));

        setMessages(history);
        setIsHistoryLoading(false);
      }
    } catch (err: any) {
      if (!isSubscribed) return;

      console.error("Error loading chat conversation:", err);

      const status = err.status || err.raw?.response?.status;
      
      if (status === 404 || err.message?.includes("404") || err.message?.includes("not found")) {
        // Conversation genuinely doesn't exist -> redirect cleanly to "/"
        router.push("/");
      } else if (status === 401) {
        // Auth session expired or invalid
        setErrorMessage("Your session has expired. Please sign in again.");
        setIsHistoryLoading(false);
      } else {
        // 500 server error or network error -> show recoverable error UI with Retry
        setErrorMessage(err.message || "Failed to load conversation. Please check your network connection.");
        setIsHistoryLoading(false);
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [conversationId, isAuthenticated, authLoading, isValidUuid, router, consumeMessageStream]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Handle inline login submission
  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim();
    if (!cleanEmail || !loginPassword) return;

    const merchantId = branding?.merchant_id;
    if (!merchantId) {
      setLoginError("Unable to resolve merchant identity. Please reload the page.");
      return;
    }

    setLoginSubmitting(true);
    setLoginError(null);

    try {
      const response = await apiClient.post<{ token: string; expires_at: string }>(
        "/api/public/auth/login",
        {
          merchant_id: merchantId,
          email: cleanEmail,
          password: loginPassword
        }
      );

      login(response.data.token, cleanEmail, response.data.expires_at);
    } catch (err: any) {
      console.error("Inline login error:", err);
      if (err.status === 401 || err.status === 403) {
        setLoginError("Invalid email or password.");
      } else {
        setLoginError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  // 1. Auth Loading State
  if (authLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] w-full font-sans select-none">
        <Loader2 className="w-8 h-8 text-secondary-500 animate-spin" />
        <span className="text-xs text-secondary-400 font-semibold mt-3">Verifying authentication...</span>
      </div>
    );
  }

  // 2. Unauthenticated State -> Render Sign In Form
  if (!isAuthenticated) {
    const displayName = branding?.display_name || "Ponion";
    const hasLogo = !!branding?.logo_url && !logoError;

    return (
      <div className="flex flex-col flex-1 items-center justify-center p-6 min-h-[60vh] max-w-md mx-auto font-sans w-full">
        <div className="bg-white border border-secondary-200 shadow-xl rounded-2xl p-6 w-full space-y-5">
          <div className="text-center space-y-1.5">
            <div
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-secondary-100 p-2 overflow-hidden shadow-xs shrink-0"
            >
              {hasLogo ? (
                <img
                  src={branding!.logo_url!}
                  alt={displayName}
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-lg font-bold text-secondary-900">
              Sign In to {displayName}
            </h3>
            <p className="text-xs text-secondary-500">
              Please sign in with your customer account to access this conversation.
            </p>
          </div>

          <form onSubmit={handleInlineLogin} className="space-y-4">
            {loginError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-secondary-700 block mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="e.g. alex@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                disabled={loginSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-secondary-300/30 text-sm placeholder-secondary-400"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-secondary-700 block mb-1.5">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                disabled={loginSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-secondary-300/30 text-sm placeholder-secondary-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!loginEmail.trim() || !loginPassword || loginSubmitting}
              style={loginEmail.trim() && loginPassword && !loginSubmitting ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
              className="w-full py-2.5 rounded-xl font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer bg-secondary-900 text-white"
            >
              {loginSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to Continue</span>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-secondary-100">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-xs text-secondary-400 hover:text-secondary-700 font-medium transition-colors cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. History Loading State
  if (isHistoryLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] w-full font-sans">
        <div className="w-8 h-8 border-3 border-secondary-200 border-t-secondary-800 rounded-full animate-spin" />
        <span className="text-xs text-secondary-400 font-semibold mt-3 select-none">Loading your chat...</span>
      </div>
    );
  }

  // 4. Recoverable Network / Server Error State
  if (errorMessage) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-8 text-center min-h-[50vh] max-w-md mx-auto font-sans select-none">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-secondary-900 mb-1">Failed to Load Chat</h3>
        <p className="text-xs text-secondary-500 mb-5 leading-relaxed">{errorMessage}</p>
        <button
          onClick={() => loadConversation()}
          className="px-4 py-2 rounded-xl bg-secondary-900 text-white text-xs font-semibold flex items-center gap-2 hover:bg-secondary-800 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // 5. Authenticated & Loaded Chat Interface
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue("");

    const userMsgId = Math.random().toString(36).substring(2, 15);
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    await consumeMessageStream(userText, userMsgId);
  };

  const handleSendDirectMessage = async (msgText: string) => {
    if (!msgText.trim() || isLoading) return;

    const userMsgId = Math.random().toString(36).substring(2, 15);
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: msgText,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    await consumeMessageStream(msgText, userMsgId);
  };

  return (
    <div className="flex flex-col flex-1 h-full max-h-full overflow-hidden w-full relative">
      {/* Dynamic Header showing conversation title */}
      <div className="flex items-center justify-between h-14 px-6 border-b border-secondary-100 bg-white shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-sm font-bold text-secondary-900 truncate">
            {conversationTitle}
          </span>
        </div>
      </div>

      {/* Scrollable messages container */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        streamingStage={streamingStage}
        streamingLabel={streamingLabel}
        onSendMessage={handleSendDirectMessage}
      />
      
      {/* Fixed input container */}
      <div className="shrink-0 bg-background-50 border-t border-secondary-100">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          isLoading={isLoading}
          disabled={!isAuthenticated}
          placeholder="Ask anything..."
        />
      </div>
    </div>
  );
}

export default ChatWindow;
