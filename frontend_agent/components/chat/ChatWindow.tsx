"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  ChatMessage, 
  mockSendMessage 
} from "@/lib/mock/chat";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import apiClient from "@/lib/api/client";

interface ChatWindowProps {
  conversationId: string;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [streamingStage, setStreamingStage] = useState<string | null>(null);
  const [streamingLabel, setStreamingLabel] = useState<string | undefined>(undefined);
  const [conversationTitle, setConversationTitle] = useState("Untitled");
  const router = useRouter();

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
      // Mark bubble with error tag
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

  useEffect(() => {
    if (!isValidUuid) {
      setNotFound(true);
      setIsHistoryLoading(false);
      return;
    }

    const loadConversation = async () => {
      setIsHistoryLoading(true);
      try {
        // 1. Check for pending initial message in sessionStorage
        const pendingKey = `pending_message_${conversationId}`;
        const pendingMessageText = sessionStorage.getItem(pendingKey);

        if (pendingMessageText) {
          // Clear it immediately so it doesn't run twice/on reload
          sessionStorage.removeItem(pendingKey);

          // Add user message optimistically
          const userMsgId = Math.random().toString(36).substring(2, 15);
          const userMsg: ChatMessage = {
            id: userMsgId,
            role: "user",
            content: pendingMessageText,
            createdAt: new Date().toISOString()
          };

          setMessages([userMsg]);
          setIsHistoryLoading(false);

          // Consume stream to trigger and persist both
          await consumeMessageStream(pendingMessageText, userMsgId);
        } else {
          // 2. Otherwise load history exactly once on mount
          const response = await apiClient.get<{ title: string; messages: any[] }>(`/agentic/conversations/${conversationId}/messages`);
          setConversationTitle(response.data.title || "Untitled");
          const history: ChatMessage[] = response.data.messages.map((m: any) => ({
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
      } catch (err) {
        console.error("Error loading chat conversation:", err);
        setNotFound(true);
        setIsHistoryLoading(false);
      }
    };

    loadConversation();
  }, [conversationId, isValidUuid, consumeMessageStream]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue("");

    // Create and append user message optimistically
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

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] max-w-md mx-auto font-sans select-none">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-6 border border-red-100">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-secondary-900 mb-2">Conversation Not Found</h2>
        <p className="text-secondary-500 text-sm leading-relaxed mb-6">
          The requested conversation could not be loaded. It may have expired or does not exist.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-5 py-2.5 rounded-xl bg-secondary-900 text-white text-sm font-semibold transition-all hover:bg-secondary-800 active:scale-95 cursor-pointer"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (isHistoryLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] w-full font-sans">
        <div className="w-8 h-8 border-3 border-secondary-200 border-t-secondary-800 rounded-full animate-spin" />
        <span className="text-xs text-secondary-400 font-semibold mt-3 select-none">Loading your chat...</span>
      </div>
    );
  }

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
          placeholder={isAuthenticated ? "Ask anything..." : "Please sign in to reply..."}
        />
      </div>
    </div>
  );
}

export default ChatWindow;
