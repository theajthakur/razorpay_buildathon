import React from "react";
import { Card } from "@/components/ui/Card";
import { ReusableSkeleton, MetricCardSkeleton } from "@/components/ui/Skeleton";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

export interface MetricTrendConfig {
  value: string;
  label?: string;
  isPositive?: boolean;
}

export interface MetricCardProps {
  id?: string;
  title: React.ReactNode;
  value: string | number;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  iconTextColor?: string;
  valueColor?: string;
  trend?: MetricTrendConfig;
  subtitle?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  icon: Icon,
  iconBgColor = "bg-primary/10",
  iconTextColor = "text-primary",
  valueColor = "text-text-primary",
  trend,
  subtitle,
  loading = false,
  className = "",
}) => {
  const cardNode = (
    <Card className={`h-full flex flex-col justify-between py-4 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-semibold text-text-secondary min-w-0 truncate">
          {title}
        </span>
        <div className={`p-2 rounded-xl shrink-0 ${iconBgColor} ${iconTextColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <h3 className={`font-heading text-3xl font-bold ${valueColor}`}>
          {value}
        </h3>
        {trend && (
          <p
            className={`text-xs font-semibold flex items-center gap-1 mt-1 ${
              trend.isPositive !== false ? "text-success" : "text-destructive"
            }`}
          >
            {trend.isPositive !== false ? (
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {trend.value} {trend.label ? trend.label : ""}
            </span>
          </p>
        )}
        {!trend && subtitle && (
          <div className="text-xs text-text-secondary flex items-center gap-1 mt-1 font-medium min-w-0 truncate">
            {typeof subtitle === "string" ? <span>{subtitle}</span> : subtitle}
          </div>
        )}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <ReusableSkeleton
        name={id ? `${id}-card` : undefined}
        loading={true}
        fallback={<MetricCardSkeleton className={className} />}
      >
        {cardNode}
      </ReusableSkeleton>
    );
  }

  return cardNode;
};
