"use client";

import React from "react";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-secondary-50 border border-secondary-100 text-secondary-500 w-fit shadow-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 animate-bounce"></span>
    </div>
  );
}
