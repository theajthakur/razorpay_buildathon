import React from "react";
import { Check } from "lucide-react";

export interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  steps,
}) => {
  return (
    <div className="w-full">
      {/* Indicator Bar */}
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = currentStep > stepNum;
          const isActive = currentStep === stepNum;

          return (
            <React.Fragment key={step}>
              {/* Step Circle & Label Container */}
              <div className="flex flex-col items-center flex-1 relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-semibold text-sm transition-all duration-300 ${
                    isCompleted
                      ? "bg-primary text-text-on-primary"
                      : isActive
                      ? "bg-primary text-text-on-primary ring-4 ring-primary-light"
                      : "bg-surface border border-border text-text-secondary"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 stroke-[3]" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`mt-2.5 text-xs font-semibold text-center whitespace-nowrap hidden sm:block ${
                    isActive ? "text-primary" : "text-text-secondary"
                  }`}
                >
                  {step}
                </span>
              </div>

              {/* Line Connector (except after last step) */}
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 transition-all duration-300 mx-2 ${
                    isCompleted ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* Mobile-only current step label */}
      <div className="mt-4 text-center sm:hidden">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          Step {currentStep} of {steps.length}:
        </span>
        <h2 className="font-heading text-lg font-bold text-text-primary mt-0.5">
          {steps[currentStep - 1]}
        </h2>
      </div>
    </div>
  );
};
