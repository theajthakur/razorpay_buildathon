"use client";

import React from "react";

interface TypingIndicatorProps {
  stage?: string;
}

export default function TypingIndicator({ stage }: TypingIndicatorProps) {
  const getStageLabel = (currentStage?: string) => {
    if (!currentStage) return "Working on it...";
    switch (currentStage) {
      case "thinking":
        return "Thinking...";
      case "searching_products":
        return "Searching products...";
      case "final_touches":
        return "Putting it together...";
      default:
        return "Working on it...";
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary-50 border border-secondary-100 text-secondary-500 w-fit shadow-xs font-sans text-xs">
      <div className="flex items-center gap-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 animate-bounce"></span>
      </div>
      <span className="font-medium animate-pulse">{getStageLabel(stage)}</span>
    </div>
  );
}
