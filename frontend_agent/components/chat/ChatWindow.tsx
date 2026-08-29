"use client";

import React, { useState, useEffect } from "react";
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
  const router = useRouter();

  // Validate conversation UUID format or mock string for testing
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidUuid = uuidRegex.test(conversationId) || conversationId === "returning-user";

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
          const userMsg: ChatMessage = {
            id: Math.random().toString(36).substring(2, 15),
            role: "user",
            content: pendingMessageText,
            createdAt: new Date().toISOString()
          };

          setMessages([userMsg]);
          setIsLoading(true);
          setIsHistoryLoading(false);

          // Save user message in DB
          try {
            const userMsgPost = await apiClient.post(`/agentic/conversations/${conversationId}/messages`, {
              sender: "user",
              message: pendingMessageText
            });
            userMsg.id = userMsgPost.data.message_id;
          } catch (err) {
            console.error("Failed to persist pending user message:", err);
            userMsg.error = true;
            setMessages([userMsg]);
          }

          // Call mock assistant reply
          const assistantReply = await mockSendMessage(conversationId, pendingMessageText);
          
          // Save assistant reply in DB
          try {
            const replyPost = await apiClient.post(`/agentic/conversations/${conversationId}/messages`, {
              sender: "agent",
              message: assistantReply.content
            });
            assistantReply.id = replyPost.data.message_id;
          } catch (err) {
            console.error("Failed to persist assistant reply:", err);
            assistantReply.error = true;
          }

          setMessages(prev => {
            const updated = [...prev];
            if (userMsg.error) {
              updated[0] = { ...userMsg };
            }
            return [...updated, assistantReply];
          });
          setIsLoading(false);
        } else {
          // 2. Otherwise load history from backend
          const response = await apiClient.get<{ messages: any[] }>(`/agentic/conversations/${conversationId}/messages`);
          const history: ChatMessage[] = response.data.messages.map((m: any) => ({
            id: m.message_id,
            role: m.sender === "agent" ? "assistant" : "user",
            content: m.message,
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
  }, [conversationId, isValidUuid]);

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
    setIsLoading(true);

    let userMsgSaved = false;
    try {
      const userMsgPost = await apiClient.post(`/agentic/conversations/${conversationId}/messages`, {
        sender: "user",
        message: userText
      });
      setMessages(prev =>
        prev.map(m => m.id === userMsgId ? { ...m, id: userMsgPost.data.message_id } : m)
      );
      userMsgSaved = true;
    } catch (err) {
      console.error("Failed to persist user message:", err);
      setMessages(prev =>
        prev.map(m => m.id === userMsgId ? { ...m, error: true } : m)
      );
    }

    try {
      const assistantReply = await mockSendMessage(conversationId, userText);
      try {
        const replyPost = await apiClient.post(`/agentic/conversations/${conversationId}/messages`, {
          sender: "agent",
          message: assistantReply.content
        });
        assistantReply.id = replyPost.data.message_id;
      } catch (err) {
        console.error("Failed to persist assistant reply:", err);
        assistantReply.error = true;
      }
      setMessages(prev => [...prev, assistantReply]);
    } catch (err) {
      console.error("Failed to generate assistant reply:", err);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className="flex flex-col flex-1 h-full max-h-full overflow-hidden w-full relative">
      {/* Scrollable messages container */}
      <MessageList messages={messages} isLoading={isLoading} />
      
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
