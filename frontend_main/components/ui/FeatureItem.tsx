"use client";

import React from "react";
import { motion } from "framer-motion";
import { fadeUpVariant } from "@/lib/motion";

export interface FeatureItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export const FeatureItem: React.FC<FeatureItemProps> = ({
  icon: Icon,
  title,
  description,
}) => {
  return (
    <motion.div
      variants={fadeUpVariant}
      className="flex flex-col space-y-3 text-left"
    >
      <div className="text-primary w-6 h-6 shrink-0 bg-transparent">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>
      <div className="space-y-1">
        <h4 className="font-heading text-sm font-bold text-text-primary uppercase tracking-wider">
          {title}
        </h4>
        <p className="text-sm text-text-secondary leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
};
