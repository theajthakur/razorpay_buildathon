import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function parseAddressResponsePath(combined: string) {
  const trimmed = (combined || "").trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { isValid: false, response_key: "", id_field: trimmed };
  }
  return {
    isValid: true,
    response_key: trimmed.substring(0, lastDot),
    id_field: trimmed.substring(lastDot + 1),
  };
}

export function extractOrderHistory(
  response: any,
  config: { array_path?: string; arrayPath?: string; response_key?: string; field_mapping?: Record<string, string>; fields?: Record<string, string> }
): any[] {
  const arrayPath = config.array_path || config.arrayPath || config.response_key || "";
  const orders = resolveArrayAt(response, arrayPath) || [];
  const fields = config.field_mapping || config.fields || {};
  return orders.map((item) => {
    if (typeof item !== "object" || item === null) return {};
    const obj: Record<string, any> = {};
    if (Object.keys(fields).length > 0) {
      for (const [key, path] of Object.entries(fields)) {
        if (path) {
          obj[key] = resolvePath(item, path);
        }
      }
    } else {
      obj.id = resolvePath(item, "id") || item.id || item._id || item.product_id;
      obj.name = resolvePath(item, "name") || item.name || item.itemName || item.title;
      obj.price = resolvePath(item, "price") || item.price || item.amount;
      obj.quantity = resolvePath(item, "quantity") || item.quantity || item.qty;
    }
    return obj;
  });
}

export function extractAddresses(
  response: any,
  config: { response_path?: string; response_key?: string; id_field?: string; display_field?: string }
): any[] {
  let arrayPath = "";
  let idField = "";
  if (config.response_path) {
    const parsed = parseAddressResponsePath(config.response_path);
    arrayPath = parsed.response_key;
    idField = parsed.id_field;
  } else {
    arrayPath = config.response_key || "";
    idField = config.id_field || "";
  }

  const addresses = resolveArrayAt(response, arrayPath) || [];
  const displayField = config.display_field || "";

  return addresses.map((item) => {
    if (typeof item !== "object" || item === null) return {};
    const addrId = idField ? resolvePath(item, idField) : item.id || item._id || item.address_id;
    const displayStr = displayField ? resolvePath(item, displayField) : null;
    return {
      address_id: addrId,
      address_string: displayStr,
    };
  });
}

export function extractCustomerProfile(
  response: any,
  config: { response_object_path?: string; response_key?: string; field_mapping?: Record<string, string>; fields?: Record<string, string> }
): Record<string, any> {
  const objPath = config.response_object_path || config.response_key || "";
  const sourceObj = objPath ? resolvePath(response, objPath) : response;
  const target = typeof sourceObj === "object" && sourceObj !== null ? sourceObj : response;
  const fields = config.field_mapping || config.fields || {};

  const result: Record<string, any> = {};
  for (const [key, path] of Object.entries(fields)) {
    if (path) {
      let val = resolvePath(target, path);
      if (val === null) {
        val = resolvePath(response, path);
      }
      if (val !== null) {
        result[key] = val;
      }
    }
  }
  return result;
}

export interface FieldMappingRow {
  key: string;
  path: string;
}

interface EndpointFieldMappingProps {
  label: string;
  fieldKey: string;
  pathValue: string;
  onChange: (val: string) => void;
  previewSource?: any;
  placeholder?: string;
  required?: boolean;
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-semibold text-text-primary capitalize">
          {label || fieldKey}
        </label>
        {pathValue.trim() !== "" && (
          <span className="text-[11px] font-mono text-text-secondary">
            Preview:{" "}
            {resolvedPreview !== null && resolvedPreview !== undefined ? (
              <span className="text-emerald-400 font-medium">
                {typeof resolvedPreview === "object" ? JSON.stringify(resolvedPreview) : String(resolvedPreview)}
              </span>
            ) : (
              <span className="text-amber-400/80 italic">No value found</span>
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

interface DynamicFieldMappingsProps {
  mappings: FieldMappingRow[];
  onChange: (newMappings: FieldMappingRow[]) => void;
  previewSampleItem?: any;
  title?: string;
  description?: string;
}

export const DynamicFieldMappings: React.FC<DynamicFieldMappingsProps> = ({
  mappings,
  onChange,
  previewSampleItem,
  title = "Field Mappings",
  description = "Map ShopAgent standard fields to arbitrary dot paths in your response objects.",
}) => {
  const handleKeyChange = (index: number, newKey: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], key: newKey };
    onChange(updated);
  };

  const handlePathChange = (index: number, newPath: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], path: newPath };
    onChange(updated);
  };

  const handleAddField = () => {
    onChange([...mappings, { key: "", path: "" }]);
  };

  const handleRemoveField = (index: number) => {
    const updated = mappings.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3.5 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddField}
          className="flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Field</span>
        </Button>
      </div>

      <div className="space-y-3">
        {mappings.length === 0 ? (
          <div className="p-4 bg-background border border-dashed border-border rounded-xl text-center text-xs text-text-secondary">
            No custom field mappings configured. Click "Add Field" to map standard or custom keys.
          </div>
        ) : (
          mappings.map((row, idx) => {
            const resolvedVal = previewSampleItem && row.path.trim() ? resolvePath(previewSampleItem, row.path) : null;
            return (
              <div
                key={idx}
                className="p-3.5 bg-background border border-border rounded-xl space-y-2.5 shadow-xs transition-colors hover:border-primary/30"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Field Key (Name)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. id, name, price"
                      value={row.key}
                      onChange={(e) => handleKeyChange(idx, e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="sm:col-span-7 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Dot Path in Item JSON
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. product.itemName or amount"
                      value={row.path}
                      onChange={(e) => handlePathChange(idx, e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end items-end sm:pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      className="p-2 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove field mapping"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {row.path.trim() !== "" && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-text-secondary text-[11px] font-sans font-medium">
                      Live Sample Preview:
                    </span>
                    {resolvedVal !== null && resolvedVal !== undefined ? (
                      <span className="text-emerald-400 font-semibold text-xs bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 max-w-[70%] truncate">
                        {typeof resolvedVal === "object" ? JSON.stringify(resolvedVal) : String(resolvedVal)}
                      </span>
                    ) : (
                      <span className="text-amber-400/90 italic text-xs bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                        No value found at '{row.path}'
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {mappings.length > 0 && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddField}
          className="flex items-center gap-1.5 text-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Another Field</span>
        </Button>
      )}
    </div>
  );
};
