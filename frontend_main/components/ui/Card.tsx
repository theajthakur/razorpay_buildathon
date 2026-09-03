import React from "react";

export interface CardProps {
  title?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  action,
  children,
  className = "",
}) => {
  return (
    <div
      className={`bg-surface border border-border rounded-xl p-6 shadow-xs ${className}`.trim()}
    >
      {(title || description || action) && (
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          <div>
            {title && (
              <h3 className="font-heading text-xl font-semibold text-text-primary">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-text-secondary mt-1">{description}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
