import React from "react";

export function ChatWindow() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/20 text-primary-500 flex items-center justify-center mb-6 animate-pulse">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-8 h-8"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-secondary-900 dark:text-background-50 font-sans mb-3">
        Ponion AI Assistant
      </h2>
      <p className="text-secondary-500 dark:text-secondary-400 text-sm leading-relaxed">
        Chat UI coming next. Soon you will be able to search menus, customize toppings, and order food through our intelligent AI conversational agent.
      </p>
    </div>
  );
}
