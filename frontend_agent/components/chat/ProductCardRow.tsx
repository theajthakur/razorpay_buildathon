import React from "react";

export function ProductCardRow() {
  return (
    <div className="p-4 border border-secondary-200 rounded-xl bg-background-50 shadow-sm max-w-sm">
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-lg bg-surface-200 animate-pulse shrink-0" />
        <div className="flex flex-col justify-between py-1">
          <div>
            <h4 className="text-sm font-bold text-secondary-900">Dish Name Placeholder</h4>
            <p className="text-xs text-secondary-500 mt-0.5">Short description of yummy food</p>
          </div>
          <span className="text-xs font-semibold text-primary-500">$0.00</span>
        </div>
      </div>
    </div>
  );
}
