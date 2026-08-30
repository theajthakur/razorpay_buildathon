"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { ChatMessage } from "@/lib/mock/chat";
import { useBranding } from "@/lib/context/BrandingContext";
import ProductCardGrid from "./ProductCardGrid";
import ProfileCard from "./ProfileCard";
import OrderHistoryCard from "./OrderHistoryCard";
import { User } from "lucide-react";

interface MessageBubbleProps {
  message: ChatMessage;
}

function renderMessageExtra(message: ChatMessage) {
  const action = message.metadata?.action;
  switch (action) {
    case "profile_card":
      return <ProfileCard profile={message.metadata?.profile} />;
    case "order_history_card":
      return <OrderHistoryCard orders={message.metadata?.orders} count={message.metadata?.count} />;
    default:
      return message.products && message.products.length > 0 ? (
        <ProductCardGrid products={message.products} />
      ) : null;
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { branding, primaryColor } = useBranding();
  const isUser = message.role === "user";

  const hasLogo = !!branding?.logo_url;

  return (
    <div className={`flex items-start gap-3 w-full ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className="shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-secondary-200 text-secondary-600 flex items-center justify-center border border-secondary-300">
            <User className="w-4 h-4" />
          </div>
        ) : hasLogo ? (
          <div className="w-8 h-8 rounded-xl overflow-hidden bg-white border border-secondary-200 flex items-center justify-center">
            <img
              src={branding!.logo_url!}
              alt={branding?.display_name || "Merchant"}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div 
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs"
          >
            {branding?.display_name ? branding.display_name.charAt(0).toUpperCase() : "A"}
          </div>
        )}
      </div>

      {/* Message Bubble Container */}
      <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
        {/* Bubble */}
        <div
          style={isUser ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
          className={`px-4 py-3 rounded-2xl shadow-xs ${
            isUser
              ? "rounded-tr-xs"
              : "bg-secondary-50 border border-secondary-100 text-secondary-900 rounded-tl-xs"
          }`}
        >
          <div className="prose prose-sm max-w-none text-inherit">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => <h1 className="text-base font-bold my-1 text-inherit" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-sm font-bold my-1 text-inherit" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-xs font-bold my-0.5 text-inherit" {...props} />,
                p: ({ node, ...props }) => <p className="text-sm leading-relaxed mb-0 text-inherit" {...props} />,
                strong: ({ node, ...props }) => (
                  <strong className={`font-bold ${isUser ? "text-white" : "text-secondary-900"}`} {...props} />
                ),
                em: ({ node, ...props }) => <em className="italic text-inherit" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-1 text-sm text-inherit" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-4 my-1 text-sm text-inherit" {...props} />,
                li: ({ node, ...props }) => <li className="mb-0.5 text-inherit" {...props} />,
                code: ({ node, ...props }) => (
                  <code 
                    className={`px-1 py-0.5 rounded text-xs font-mono ${
                      isUser ? "bg-white/20 text-white" : "bg-secondary-100 text-secondary-800"
                    }`} 
                    {...props} 
                  />
                ),
                pre: ({ node, ...props }) => (
                  <pre 
                    className={`p-2 rounded-lg text-xs font-mono my-1 overflow-x-auto border ${
                      isUser ? "bg-white/10 border-white/20 text-white" : "bg-secondary-50 border-secondary-200 text-secondary-800"
                    }`} 
                    {...props} 
                  />
                ),
                a: ({ node, ...props }) => (
                  <a 
                    className={`underline hover:opacity-80 font-medium ${
                      isUser ? "text-white" : "text-primary-600"
                    }`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    {...props} 
                  />
                )
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Dynamic Chat Cards / Extra Content */}
        {renderMessageExtra(message)}

        {/* Timestamp & Error */}
        <div className="flex items-center gap-2 mt-1 px-1 self-start">
          <span className="text-[10px] text-secondary-400 select-none font-medium">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {message.error && (
            <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5 select-none animate-pulse">
              • Not saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
