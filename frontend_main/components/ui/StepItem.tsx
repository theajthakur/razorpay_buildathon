"use client";

import React from "react";
import { motion } from "framer-motion";
import { fadeUpVariant } from "@/lib/motion";

export interface StepItemProps {
  number: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const StepItem: React.FC<StepItemProps> = ({
  number,
  label,
  description,
  icon: Icon,
}) => {
  return (
    <motion.div
      variants={fadeUpVariant}
      className="flex flex-col space-y-4 text-left"
    >
      {/* Icon Outline Frame */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center text-primary shrink-0 bg-transparent">
          <Icon className="w-6 h-6 stroke-[1.75]" />
        </div>
        <div className="font-heading text-sm font-bold text-text-secondary font-mono tracking-wider">
          STEP {number}
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="font-heading text-lg font-bold text-text-primary">
          {label}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
};
