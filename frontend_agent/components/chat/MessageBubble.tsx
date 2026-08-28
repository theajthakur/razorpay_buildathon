import React from "react";

export function MessageBubble() {
  return (
    <div className="p-4 rounded-2xl bg-surface-200 text-secondary-900 dark:bg-secondary-850 dark:text-background-50 max-w-[80%] shadow-sm">
      <p className="text-sm font-sans font-medium">Hello! I am your Ponion food ordering agent. How can I help you eat today?</p>
    </div>
  );
}
