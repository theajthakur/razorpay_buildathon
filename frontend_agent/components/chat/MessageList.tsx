"use client";

import React, { useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/mock/chat";
import { MessageBubble } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  streamingStage?: string | null;
  streamingLabel?: string;
}

export default function MessageList({ messages, isLoading, streamingStage, streamingLabel }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the bottom of the container
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 w-full max-w-full flex flex-col no-scrollbar">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      
      {isLoading && (
        <div className="flex items-start gap-3 w-full animate-fade-in">
          {/* Avatar offset */}
          <div className="w-8 h-8 shrink-0" />
          <TypingIndicator stage={streamingStage || undefined} label={streamingLabel} />
        </div>
      )}
      
      <div ref={bottomRef} />
    </div>
  );
}
