import React from "react";

export function ChatInput() {
  return (
    <div className="w-full p-4 border-t border-secondary-200 dark:border-secondary-800 bg-background-50 dark:bg-secondary-900">
      <div className="relative flex items-center max-w-3xl mx-auto">
        <input
          type="text"
          placeholder="Ask Ponion to order food... (Coming soon)"
          className="w-full pl-4 pr-12 py-3 rounded-xl border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-850 text-secondary-900 dark:text-background-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-sm placeholder-secondary-400 dark:placeholder-secondary-500 cursor-not-allowed"
          disabled
        />
        <button
          disabled
          className="absolute right-2.5 p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950/20 text-primary-500 cursor-not-allowed opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
