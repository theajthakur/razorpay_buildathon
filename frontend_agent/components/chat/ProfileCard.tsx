"use client";

import React from "react";
import { User, Award, Calendar, Mail } from "lucide-react";

export interface ProfileData {
  name?: string;
  email?: string;
  loyalty_tier?: string;
  member_since?: string;
  [key: string]: any;
}

interface ProfileCardProps {
  profile?: ProfileData;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  if (!profile) return null;

  const { name, email, loyalty_tier, member_since } = profile;

  // Format member since date cleanly if available
  const formattedMemberSince = React.useMemo(() => {
    if (!member_since) return null;
    try {
      const d = new Date(member_since);
      if (isNaN(d.getTime())) return member_since;
      return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    } catch {
      return member_since;
    }
  }, [member_since]);

  // Determine loyalty tier badge styling
  const tierStyle = React.useMemo(() => {
    if (!loyalty_tier) return null;
    const tierLower = loyalty_tier.toLowerCase();
    if (tierLower.includes("gold")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    } else if (tierLower.includes("platinum") || tierLower.includes("diamond")) {
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    } else if (tierLower.includes("silver")) {
      return "bg-slate-100 text-slate-700 border-slate-300";
    }
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }, [loyalty_tier]);

  return (
    <div className="mt-3 w-full max-w-sm rounded-2xl border border-secondary-200 bg-white p-4 shadow-xs select-none font-sans">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0">
          {name ? name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          {name && (
            <h4 className="text-sm font-bold text-secondary-900 truncate leading-snug">
              {name}
            </h4>
          )}
          {email && (
            <span className="text-xs text-secondary-500 truncate flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 text-secondary-400 shrink-0" />
              {email}
            </span>
          )}
        </div>
      </div>

      {(loyalty_tier || formattedMemberSince) && (
        <div className="mt-3 pt-3 border-t border-secondary-100 flex items-center justify-between gap-2 text-xs">
          {loyalty_tier && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${tierStyle}`}>
              <Award className="w-3 h-3" />
              {loyalty_tier}
            </span>
          )}

          {formattedMemberSince && (
            <span className="text-secondary-400 font-medium flex items-center gap-1 ml-auto text-[11px]">
              <Calendar className="w-3 h-3 text-secondary-400" />
              Member since {formattedMemberSince}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileCard;
