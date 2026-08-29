"use client";

import React, { useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { useBranding } from "@/lib/context/BrandingContext";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = "Message the assistant..."
}: ChatInputProps) {
  const { primaryColor } = useBranding();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea height based on typing content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleSend = () => {
    if (value.trim() && !isLoading) {
      onSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
      <div className="relative flex items-end w-full rounded-2xl border border-secondary-200 bg-white shadow-xs focus-within:shadow-md focus-within:border-secondary-300 transition-all">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 w-full pl-4 pr-14 py-3.5 bg-transparent text-secondary-900 text-sm focus:outline-none placeholder-secondary-400 resize-none max-h-[150px] overflow-y-auto leading-relaxed"
        />
        
        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          style={value.trim() && !isLoading ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
          className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all duration-200 active:scale-95 ${
            value.trim() && !isLoading
              ? "text-white cursor-pointer"
              : "bg-secondary-100 text-secondary-400 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatInput;
