import React from "react";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * A container component that allows vertical scrolling while hiding the scrollbar track and thumb.
 * Leverages the custom `no-scrollbar` Tailwind utility.
 */
export function ScrollArea({ children, className = "", ...props }: ScrollAreaProps) {
  return (
    <div
      className={`overflow-y-auto no-scrollbar ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
