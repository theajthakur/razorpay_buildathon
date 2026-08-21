import React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, id, className = "", ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const baseInputStyles =
      "w-full bg-surface border rounded-lg px-3.5 py-2.5 text-base text-text-primary placeholder:text-text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1";

    const stateStyles = error
      ? "border-error focus:ring-error focus:border-error"
      : "border-border focus:ring-primary focus:border-transparent";

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-primary mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${baseInputStyles} ${stateStyles} ${className}`.trim()}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 text-xs text-error">{error}</p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
