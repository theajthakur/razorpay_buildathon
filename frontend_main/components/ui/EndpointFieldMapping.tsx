import React from "react";

/**
 * Dot-path resolution helper for merchant onboarding live preview and field mappings.
 * Mirrors backend resolve_path in field_mappings.py exactly.
 */
export function resolvePath(source: any, path: string): any {
  if (!path || typeof source !== "object" || source === null) {
    return null;
  }
  let current: any = source;
  const segments = path
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const segment of segments) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }
  return current ?? null;
}

export function resolveArrayAt(source: any, path?: string | null): any[] | null {
  const value = path ? resolvePath(source, path) : source;
  return Array.isArray(value) ? value : null;
}

export function extractOrderHistory(
  response: any,
  config: { arrayPath?: string; fields?: Record<string, string> }
): any[] {
  const orders = resolveArrayAt(response, config.arrayPath) || [];
  const fields = config.fields || {};
  return orders.map((item) => ({
    id: resolvePath(item, fields.id || ""),
    name: resolvePath(item, fields.name || ""),
    price: resolvePath(item, fields.price || ""),
    quantity: resolvePath(item, fields.quantity || ""),
  }));
}

export function extractAddresses(
  response: any,
  config: { arrayPath?: string; idField?: string; displayField?: string }
): any[] {
  const addresses = resolveArrayAt(response, config.arrayPath) || [];
  const idField = config.idField || "";
  const displayField = config.displayField || "";
  return addresses.map((item) => ({
    address_id: resolvePath(item, idField),
    address_string: resolvePath(item, displayField),
  }));
}

export function extractCustomerProfile(
  response: any,
  config: { fields?: Record<string, string> }
): Record<string, any> {
  const fields = config.fields || {};
  const result: Record<string, any> = {};
  for (const key of ["name", "email", "phone"]) {
    const path = fields[key] || "";
    if (path) {
      result[key] = resolvePath(response, path);
    }
  }
  return result;
}

interface EndpointFieldMappingProps {
  label: string;
  fieldKey: string;
  pathValue: string;
  onChange: (val: string) => void;
  previewSource?: any;
  placeholder?: string;
}

export const EndpointFieldMapping: React.FC<EndpointFieldMappingProps> = ({
  label,
  fieldKey,
  pathValue,
  onChange,
  previewSource,
  placeholder = "e.g. data.items",
}) => {
  const resolvedPreview = previewSource ? resolvePath(previewSource, pathValue) : null;

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-primary capitalize">
          {label || fieldKey}
        </label>
        {pathValue.trim() && (
          <span className="text-[11px] font-mono text-text-secondary">
            Preview:{" "}
            {resolvedPreview !== null ? (
              <span className="text-emerald-400 font-medium">
                {JSON.stringify(resolvedPreview)}
              </span>
            ) : (
              <span className="text-amber-400/80 italic">null (not found)</span>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center bg-background border border-border rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-colors">
        <input
          type="text"
          value={pathValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent border-0 p-0 text-xs text-text-primary placeholder:text-text-secondary focus:ring-0 focus:outline-none font-mono"
        />
      </div>
    </div>
  );
};
