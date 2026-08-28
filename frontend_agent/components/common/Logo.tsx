import React from "react";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50 text-primary-500 transition-colors">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          {/* Onion outer bulb shape */}
          <path d="M12 2C8.5 6.5 5.5 9.5 5.5 13.5a6.5 6.5 0 0 0 13 0c0-4-3-7-6.5-11.5z" />
          {/* Inner layer arches to represent onion segments */}
          <path d="M12 5.5c-2.2 3.2-3.8 5.8-3.8 8a3.8 3.8 0 0 0 7.6 0c0-2.2-1.6-4.8-3.8-8z" />
          <path d="M12 9.5c-.8 1.5-1.5 2.8-1.5 4a1.5 1.5 0 0 0 3 0c0-1.2-.7-2.5-1.5-4z" />
        </svg>
      </div>
      <span className="text-xl font-bold tracking-tight text-secondary-900 font-sans">
        Pon<span className="text-primary-500">ion</span>
      </span>
    </div>
  );
}
