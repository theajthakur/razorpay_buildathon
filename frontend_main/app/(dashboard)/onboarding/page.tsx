"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { StatusBadge, StatusType } from "@/components/ui/StatusBadge";
import {
  BadgeCheck,
  Landmark,
  ShieldCheck,
  Database,
  Loader2,
  AlertTriangle,
  X,
  ArrowRight,
  Check,
  Edit3,
  HelpCircle,
  Lock,
  Unlock,
  Info,
  Server,
  Play,
  UploadCloud,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  FileCheck,
  RefreshCw
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  fetchOnboardingDetails,
  saveOnboardingDetails,
  patchOnboardingDetails,
  testEndpoint,
  testCustomerAuth,
  OnboardingData,
  VerifyOrderConfig
} from "@/lib/api/onboarding";
import { getPresignedLogoUrl, uploadFileToS3 } from "@/lib/api/settings";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";
import {
  EndpointFieldMapping,
  DynamicFieldMappings,
  FieldMappingRow,
  resolvePath,
  resolveArrayAt,
  parseAddressResponsePath,
} from "@/components/ui/EndpointFieldMapping";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { toast } from "sonner";

function parseAddressPath(combined: string) {
  const trimmed = combined.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { isValid: false, response_key: "", id_field: "" };
  }
  return {
    isValid: true,
    response_key: trimmed.substring(0, lastDot),
    id_field: trimmed.substring(lastDot + 1)
  };
}

const SaveIndicator = ({ status, error }: { status?: string; error?: string }) => {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary animate-pulse font-medium">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success font-medium animate-fade-in">
        <Check className="w-3.5 h-3.5" /> Saved ✓
      </span>
    );
  }
  if (status === "error" || error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-error font-medium" title={error}>
        <AlertTriangle className="w-3.5 h-3.5" /> Save failed
      </span>
    );
  }
  return null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn: authSignedIn } = useAuth();

  // Loading and saving states
  const [pageLoading, setPageLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSavedToDb, setIsSavedToDb] = useState(false);

  // Edit & Change Tracking States
  const [isEditing, setIsEditing] = useState(true);
  const [originalConfig, setOriginalConfig] = useState<any>(null);

  // Per-field / Section Autosave States
  const [saveStatuses, setSaveStatuses] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  // Real Logo Crop & Upload State
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  // Branding & Webhook States
  const [colorTheme, setColorTheme] = useState("#4338CA");
  const [logoUrl, setLogoUrl] = useState("");
  const [webhookPath, setWebhookPath] = useState("webhook/merchant-os");

  // Modals state
  const [showConfirmDisableModal, setShowConfirmDisableModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingStep, setMappingStep] = useState(1); // 1 | 2 | 3 | 4
  const [activeResource, setActiveResource] = useState<string | null>(null);

  // Active Session Token (tested in Step 1, reused in Step 2)
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Connection Details State (Path-Only)
  const [baseUrl, setBaseUrl] = useState("https://ponion-backend.onrender.com");
  const [authEnabled, setAuthEnabled] = useState(true);
  const [authDisabledAck, setAuthDisabledAck] = useState(false);
  const [authPath, setAuthPath] = useState("auth/login");
  const [authMethod, setAuthMethod] = useState("POST");

  // Custom authConfig structure
  const [authConfig, setAuthConfig] = useState<any>({
    identifier_field: "email",
    identifier_type: "Email",
    password_field: "password",
    token_path: "token",
    token_delivery: {
      method: "header",
      header_name: "Authorization",
      bearer_prefix: true,
      cookie_name: "session"
    },
    isConfigured: false,
  });

  // Mapping Modal Local States
  const [modalIdentifierField, setModalIdentifierField] = useState("email");
  const [modalIdentifierType, setModalIdentifierType] = useState("Email");
  const [modalPasswordField, setModalPasswordField] = useState("password");
  const [testIdentifierValue, setTestIdentifierValue] = useState("demo@example.com");
  const [testPasswordValue, setTestPasswordValue] = useState("password123");
  const [testResponseData, setTestResponseData] = useState<any>(null);
  const [tokenPath, setTokenPath] = useState("token");
  const [tokenPathStatus, setTokenPathStatus] = useState<"success" | "error" | "none">("none");
  const [deliveryType, setDeliveryType] = useState<"header" | "cookie">("header");
  const [headerName, setHeaderName] = useState("Authorization");
  const [addBearer, setAddBearer] = useState(true);
  const [cookieName, setCookieName] = useState("session");
  const [testLoading, setTestLoading] = useState(false);

  // Endpoints Mapping State
  const [endpoints, setEndpoints] = useState<any>({
    products: { path: "products", method: "GET", payload_key: "query", response_key: "products" },
    orderHistory: { path: "orders/history", method: "GET", response_key: "orders" },
    customerProfile: { path: "customers", method: "GET" },
    addresses: {
      fetch_path: "addresses",
      fetch_method: "GET",
      fetch_response_key: "addresses",
      id_field: "_id",
      create_path: "addresses",
      create_method: "POST",
      create_fields: "line1, line2, city, state, pincode"
    },
    createOrder: {
      path: "orders",
      method: "POST",
      cart_key: "cart",
      item_id_field: "item_id",
      price_field: "price",
      quantity_field: "quantity"
    },
    verifyOrder: {
      path: "user/payments",
      method: "POST",
      order_id_field: "merchantOrderId",
      response_price_field: "price"
    }
  });

  // Resource Statuses
  const [endpointStatuses, setEndpointStatuses] = useState<{
    products: StatusType;
    orderHistory: StatusType;
    customerProfile: StatusType;
    addresses: StatusType;
    createOrder: StatusType;
    verifyOrder: StatusType;
  }>({
    products: "untested",
    orderHistory: "untested",
    customerProfile: "untested",
    addresses: "untested",
    createOrder: "untested",
    verifyOrder: "untested",
  });

  // Scoped Resource Modal Fields State
  const [prodPath, setProdPath] = useState("products");
  const [prodPayloadKey, setProdPayloadKey] = useState("query");
  const [prodResponseKey, setProdResponseKey] = useState("products");
  const [prodTestTerm, setProdTestTerm] = useState("laptop");

  const [ohPath, setOhPath] = useState("orders/history");
  const [ohArrayPath, setOhArrayPath] = useState("data.orders");
  const [ohFieldMappings, setOhFieldMappings] = useState<FieldMappingRow[]>([
    { key: "id", path: "product_id" },
    { key: "name", path: "product.itemName" },
    { key: "price", path: "amount" },
    { key: "quantity", path: "quantity" },
  ]);

  const [cpPath, setCpPath] = useState("customers");
  const [cpResponseObjectPath, setCpResponseObjectPath] = useState("data");
  const [cpFieldMappings, setCpFieldMappings] = useState<FieldMappingRow[]>([
    { key: "name", path: "name" },
    { key: "email", path: "email" },
    { key: "phone", path: "phone" },
  ]);

  const [addrActiveTab, setAddrActiveTab] = useState<"fetch" | "create">("fetch");
  const [addrSupportsCreation, setAddrSupportsCreation] = useState(false);
  const [addrFetchTested, setAddrFetchTested] = useState(false);
  const [addrSelfCertified, setAddrSelfCertified] = useState(false);
  const [addrFetchPath, setAddrFetchPath] = useState("users/addresses");
  const [addrCombinedPath, setAddrCombinedPath] = useState("data.addresses._id");
  const [addrDisplayField, setAddrDisplayField] = useState("address");
  const [addrFetchResponseKey, setAddrFetchResponseKey] = useState("data.addresses");
  const [addrFetchIdField, setAddrFetchIdField] = useState("_id");
  const [addrCreatePath, setAddrCreatePath] = useState("addresses");
  const [addrCreateFields, setAddrCreateFields] = useState("line1, line2, city, state, pincode");
  const [addrCreateTestInputs, setAddrCreateTestInputs] = useState<Record<string, string>>({
    line1: "123 Main St",
    line2: "Apt 4B",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001"
  });

  const [coPath, setCoPath] = useState("orders");
  const [coCartKey, setCoCartKey] = useState("cart");
  const [coItemIdField, setCoItemIdField] = useState("item_id");
  const [coPriceField, setCoPriceField] = useState("price");
  const [coQuantityField, setCoQuantityField] = useState("quantity");
  const [coAddressIdField, setCoAddressIdField] = useState("address_id");
  const [coAdditionalFields, setCoAdditionalFields] = useState<Array<{ key: string; value: string }>>([]);
  const [coSelfCertified, setCoSelfCertified] = useState(false);
  const [coTestItemId, setCoTestItemId] = useState("item_999");
  const [coTestPrice, setCoTestPrice] = useState("299");
  const [coTestQuantity, setCoTestQuantity] = useState("1");

  // Verify Order Amount Endpoint State
  const [voPath, setVoPath] = useState("user/payments");
  const [voMethod, setVoMethod] = useState("POST");
  const [voOrderIdField, setVoOrderIdField] = useState("merchantOrderId");
  const [voResponsePriceField, setVoResponsePriceField] = useState("price");

  // Scoped Modal Test Results
  const [modalTestResponse, setModalTestResponse] = useState<any>(null);
  const [modalTestStatus, setModalTestStatus] = useState<"untested" | "success" | "error">("untested");
  const [modalTestLoading, setModalTestLoading] = useState(false);

  // Bank Settlement Account State
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [ifscError, setIfscError] = useState("");
  const [resolvedBank, setResolvedBank] = useState("");
  const [resolvedBranch, setResolvedBranch] = useState("");
  const [bankVerified, setBankVerified] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);

  // Centralized Autosave Engine
  const handleAutosave = async (sectionKey: string, patchData: Partial<OnboardingData>) => {
    setSaveStatuses(prev => ({ ...prev, [sectionKey]: "saving" }));
    setSaveErrors(prev => ({ ...prev, [sectionKey]: "" }));

    try {
      const updated = await patchOnboardingDetails(patchData);
      setOriginalConfig(updated);
      setSaveStatuses(prev => ({ ...prev, [sectionKey]: "saved" }));
      setTimeout(() => {
        setSaveStatuses(prev => ({ ...prev, [sectionKey]: "idle" }));
      }, 2500);
    } catch (err: any) {
      console.error(`Autosave failed for ${sectionKey}:`, err);
      setSaveStatuses(prev => ({ ...prev, [sectionKey]: "error" }));
      const msg = err?.response?.data?.detail || "Autosave failed. Please check field inputs.";
      setSaveErrors(prev => ({ ...prev, [sectionKey]: msg }));
      toast.error(`Autosave failed: ${msg}`);
    }
  };

  // Debounced Autosave for Text Inputs
  const debouncedSaveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const triggerDebouncedAutosave = (sectionKey: string, patchData: Partial<OnboardingData>, delayMs = 500) => {
    setSaveStatuses(prev => ({ ...prev, [sectionKey]: "saving" }));
    if (debouncedSaveTimeoutRef.current[sectionKey]) {
      clearTimeout(debouncedSaveTimeoutRef.current[sectionKey]);
    }
    debouncedSaveTimeoutRef.current[sectionKey] = setTimeout(() => {
      handleAutosave(sectionKey, patchData);
    }, delayMs);
  };

  // Load existing onboarding details on mount
  useEffect(() => {
    async function loadOnboarding() {
      try {
        const config = await fetchOnboardingDetails();
        if (config) {
          setIsSavedToDb(true);
          setOriginalConfig(config);
          setIsEditing(true);
          if (config.base_url && config.base_url !== "http://placeholder" && config.base_url.trim() !== "") {
            setBaseUrl(config.base_url);
          }
          setAuthEnabled(config.auth_enabled);
          setAuthDisabledAck(config.auth_disabled_ack);

          if (config.branding_config) {
            setColorTheme(config.branding_config.brand_color || "#4338CA");
            setLogoUrl(config.branding_config.logo_url || "");
          }
          setWebhookPath(config.webhook_path || config.webhook_url || "webhook/merchant-os");

          if (config.auth_config) {
            setAuthPath(config.auth_config.path || config.auth_config.auth_url || "auth/login");
            setAuthMethod(config.auth_config.method || "POST");
            setModalIdentifierField(config.auth_config.identifier_field || "email");
            setModalIdentifierType(config.auth_config.identifier_type || "Email");
            setModalPasswordField(config.auth_config.password_field || "password");
            setTokenPath(config.auth_config.token_path || "token");

            const delivery = config.auth_config.token_delivery || {
              method: "header",
              header_name: "Authorization",
              bearer_prefix: true,
              cookie_name: "session"
            };
            setDeliveryType(delivery.method);
            setHeaderName(delivery.header_name || "Authorization");
            setAddBearer(delivery.bearer_prefix !== false);
            setCookieName(delivery.cookie_name || "session");

            setAuthConfig({
              isConfigured: true,
              path: config.auth_config.path || config.auth_config.auth_url,
              method: config.auth_config.method,
              identifier_field: config.auth_config.identifier_field,
              identifier_type: config.auth_config.identifier_type,
              password_field: config.auth_config.password_field,
              token_path: config.auth_config.token_path,
              token_delivery: delivery
            });
          }

          if (config.products_config) {
            setProdPath(config.products_config.path || "products");
            setProdPayloadKey(config.products_config.payload_key || "query");
            setProdResponseKey(config.products_config.response_key || "products");
          }

          if (config.order_history_config) {
            const oh = config.order_history_config as any;
            setOhPath(oh.path || "orders/history");
            setOhArrayPath(oh.array_path || oh.response_key || "data.orders");
            const rawMappings = oh.field_mapping || oh.fields;
            if (rawMappings && typeof rawMappings === "object" && Object.keys(rawMappings).length > 0) {
              setOhFieldMappings(Object.entries(rawMappings).map(([k, p]) => ({ key: k, path: String(p) })));
            }
          }

          if (config.customer_profile_config) {
            const cp = config.customer_profile_config as any;
            setCpPath(cp.path || "customers");
            setCpResponseObjectPath(cp.response_object_path || cp.response_key || "");
            const rawMappings = cp.field_mapping || cp.fields;
            if (rawMappings && typeof rawMappings === "object" && Object.keys(rawMappings).length > 0) {
              setCpFieldMappings(Object.entries(rawMappings).map(([k, p]) => ({ key: k, path: String(p) })));
            }
          }

          if (config.addresses_config) {
            const addrs = config.addresses_config as any;
            const supports = addrs.supports_creation === true || !!addrs.create;
            setAddrSupportsCreation(supports);
            if (addrs.fetch) {
              setAddrFetchPath(addrs.fetch.path || "users/addresses");
              const respPath = addrs.fetch.response_path || (addrs.fetch.response_key && addrs.fetch.id_field ? `${addrs.fetch.response_key}.${addrs.fetch.id_field}` : "data.addresses._id");
              setAddrCombinedPath(respPath);
              setAddrDisplayField(addrs.fetch.display_field || "");
              const parsed = parseAddressPath(respPath);
              if (parsed.isValid) {
                setAddrFetchResponseKey(parsed.response_key);
                setAddrFetchIdField(parsed.id_field);
              }
            }
            if (addrs.create) {
              setAddrCreatePath(addrs.create.path || "addresses");
              setAddrCreateFields(addrs.create.field_mapping ? addrs.create.field_mapping.join(", ") : "line1, line2, city, state, pincode");
            }
            setAddrFetchTested(true);
            setAddrSelfCertified(true);
          }

          if (config.create_order_config) {
            const co = config.create_order_config as any;
            setCoPath(co.path || "orders");
            setCoCartKey(co.cart_key || "cart");
            setCoItemIdField(co.item_id_field || "item_id");
            setCoPriceField(co.price_field || "price");
            setCoQuantityField(co.quantity_field || "quantity");
            setCoAddressIdField(co.address_id_field || "address_id");
            setCoAdditionalFields(Array.isArray(co.additional_fields) ? co.additional_fields : []);
            setCoSelfCertified(true);
          }

          if (config.verify_order_config) {
            const vo = config.verify_order_config as any;
            setVoPath(vo.path || "user/payments");
            setVoMethod(vo.method || "POST");
            setVoOrderIdField(vo.order_id_field || "merchantOrderId");
            setVoResponsePriceField(vo.response_price_field || "price");
          }

          if (config.bank_account) setBankAccount(config.bank_account);
          if (config.ifsc) {
            setIfsc(config.ifsc);
            handleIfscLookup(config.ifsc);
          }

          setEndpointStatuses({
            products: "success",
            orderHistory: "success",
            customerProfile: "success",
            addresses: "success",
            createOrder: "configured",
            verifyOrder: "configured",
          });
        } else {
          setIsEditing(true);
        }
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error("Failed to load onboarding info: ", err);
        }
      } finally {
        setPageLoading(false);
      }
    }

    const cachedToken = sessionStorage.getItem("test_session_token");
    if (cachedToken) {
      setSessionToken(cachedToken);
    }

    if (authLoaded) {
      if (authSignedIn) {
        loadOnboarding();
      } else {
        setPageLoading(false);
      }
    }
  }, [authLoaded, authSignedIn]);

  const getNestedValue = (obj: any, path: string): any => {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((acc, part) => acc && acc[part], obj);
  };

  const findTokenPathInObject = (obj: any, path = ""): string | null => {
    if (!obj || typeof obj !== "object") return null;
    const tokenKeys = ["token", "access_token", "auth_token", "secret", "key", "credentials", "jwt"];
    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      if (tokenKeys.includes(key.toLowerCase()) && typeof obj[key] === "string") {
        return currentPath;
      }
      if (typeof obj[key] === "object") {
        const nestedPath = findTokenPathInObject(obj[key], currentPath);
        if (nestedPath) return nestedPath;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!testResponseData || !tokenPath) {
      setTokenPathStatus("none");
      return;
    }
    const val = getNestedValue(testResponseData, tokenPath);
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      setTokenPathStatus("success");
    } else {
      setTokenPathStatus("error");
    }
  }, [tokenPath, testResponseData]);

  const handleToggleAuth = (checked: boolean) => {
    if (!checked) {
      setShowConfirmDisableModal(true);
    } else {
      setAuthEnabled(true);
      setAuthDisabledAck(false);
      handleAutosave("connection", { auth_enabled: true, auth_disabled_ack: false });
    }
  };

  const confirmDisableAuth = () => {
    setAuthEnabled(false);
    setAuthDisabledAck(true);
    setShowConfirmDisableModal(false);
    handleAutosave("connection", { auth_enabled: false, auth_disabled_ack: true });
    toast.warning("Customer authentication disabled. Shop assistant will operate in anonymous guest mode.");
  };

  const handleIfscLookup = async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    setIfsc(cleaned);

    if (cleaned.length !== 11) {
      setResolvedBank("");
      setResolvedBranch("");
      setBankVerified(false);
      setIfscError("");
      return;
    }

    setBankLoading(true);
    setIfscError("");

    try {
      const res = await fetch(`https://ifsc.razorpay.com/${cleaned}`);
      if (!res.ok) {
        throw new Error("Invalid IFSC");
      }
      const data = await res.json();
      setResolvedBank(data.BANK);
      setResolvedBranch(data.BRANCH);
      setBankVerified(true);
      handleAutosave("settlement", { ifsc: cleaned, branch_name: data.BRANCH || data.BANK });
    } catch (err) {
      setIfscError("Failed to detect branch. Please check the IFSC code.");
      setResolvedBank("");
      setResolvedBranch("");
      setBankVerified(false);
    } finally {
      setBankLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedLogoFile(file);
      setIsCropperOpen(true);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setIsLogoUploading(true);
      const fileName = selectedLogoFile?.name || "logo.png";
      const fileType = croppedBlob.type || "image/png";

      const presignData = await getPresignedLogoUrl(fileName, fileType);
      const fileToUpload = new File([croppedBlob], fileName, { type: fileType });
      await uploadFileToS3(presignData.uploadUrl, fileToUpload, fileType);

      const publicUrl = presignData.publicUrl;
      setLogoUrl(publicUrl);

      await handleAutosave("branding", {
        branding_config: { brand_color: colorTheme, logo_url: publicUrl }
      });

      toast.success("Logo uploaded & saved successfully!");
      setIsCropperOpen(false);
      setSelectedLogoFile(null);
    } catch (err: any) {
      console.error("Error processing logo upload:", err);
      toast.error("Failed to upload logo image. Please try again.");
    } finally {
      setIsLogoUploading(false);
    }
  };

  const handleTestCustomerAuth = async () => {
    setTestLoading(true);
    setTestResponseData(null);
    try {
      const reqPayload = {
        [modalIdentifierField]: testIdentifierValue,
        [modalPasswordField]: testPasswordValue
      };

      const result = await testCustomerAuth({
        base_url: baseUrl,
        auth_path: authPath,
        auth_method: authMethod,
        payload: reqPayload
      });

      setTestResponseData(result.data);

      if (result.status === "success") {
        toast.success("Received login response from server!");
        const detected = findTokenPathInObject(result.data);
        if (detected) {
          setTokenPath(detected);
          setTokenPathStatus("success");
          toast.success(`Automatically detected token at: "${detected}"`);
        } else {
          setTokenPath("");
          setTokenPathStatus("none");
          toast.info("No matching token keys found. Please input token path manually.");
        }
        setMappingStep(3);
      } else {
        toast.error(`Server returned error status code: ${result.status_code}`);
      }
    } catch (err) {
      toast.error("Failed to connect to authentication path.");
    } finally {
      setTestLoading(false);
    }
  };

  const handleSaveMappingStep1 = () => {
    if (!modalIdentifierField.trim()) {
      toast.error("Identifier field name is required.");
      return;
    }
    if (!modalPasswordField.trim()) {
      toast.error("Password field name is required.");
      return;
    }
    setMappingStep(2);
  };

  const saveFullAuthConfig = () => {
    if (tokenPathStatus === "error") {
      toast.error("Please enter a valid token path that resolves in the server response.");
      return;
    }

    const deliveryConfig = {
      method: deliveryType,
      header_name: deliveryType === "header" ? headerName : null,
      bearer_prefix: deliveryType === "header" ? addBearer : null,
      cookie_name: deliveryType === "cookie" ? cookieName : null,
    };

    const newAuthConfig = {
      isConfigured: true,
      path: authPath,
      method: authMethod,
      identifier_field: modalIdentifierField,
      identifier_type: modalIdentifierType,
      password_field: modalPasswordField,
      token_path: tokenPath,
      token_delivery: deliveryConfig
    };

    setAuthConfig(newAuthConfig);

    if (testResponseData) {
      const token = getNestedValue(testResponseData, tokenPath);
      if (token) {
        setSessionToken(token);
        sessionStorage.setItem("test_session_token", token);
      }
    }

    setShowMappingModal(false);
    handleAutosave("connection", { auth_config: newAuthConfig as any });
    toast.success("Customer login configurations saved successfully!");
  };

  const handleOpenResourceModal = (resourceKey: string) => {
    setActiveResource(resourceKey);
    setModalTestResponse(null);
    setModalTestStatus("untested");
    setModalTestLoading(false);

    if (resourceKey === "addresses") {
      setAddrActiveTab("fetch");
    }
  };

  const handleSaveAndTestResource = async (resourceKey: string) => {
    setModalTestLoading(true);
    setModalTestResponse(null);

    let path = "";
    let method = "GET";
    let reqPayload: Record<string, any> = {};

    if (resourceKey === "products") {
      path = prodPath;
      method = "GET";
      reqPayload = { [prodPayloadKey]: prodTestTerm };
    } else if (resourceKey === "orderHistory") {
      path = ohPath;
      method = "GET";
    } else if (resourceKey === "customerProfile") {
      path = cpPath;
      method = "GET";
    } else if (resourceKey === "addresses") {
      if (addrActiveTab === "fetch") {
        path = addrFetchPath;
        method = "GET";
      } else {
        path = addrCreatePath;
        method = "POST";
        reqPayload = addrCreateTestInputs;
      }
    } else if (resourceKey === "createOrder") {
      path = coPath;
      method = "POST";
      reqPayload = {
        [coCartKey]: [
          {
            [coItemIdField]: coTestItemId,
            [coPriceField]: Number(coTestPrice) || 0,
            [coQuantityField]: Number(coTestQuantity) || 1
          }
        ],
        [coAddressIdField]: "addr_mock_123"
      };
    } else if (resourceKey === "verifyOrder") {
      path = voPath;
      method = voMethod;
      reqPayload = {
        [voOrderIdField]: "ord_sample_999"
      };
    }

    const activeToken = sessionToken || (typeof window !== "undefined" ? sessionStorage.getItem("test_session_token") : null);

    if (authEnabled && !activeToken) {
      toast.warning("No test session token active. Customer endpoints requiring authentication may return 401 Unauthorized.");
    }

    try {
      const result = await testEndpoint({
        base_url: baseUrl,
        auth_needed: authEnabled,
        credential_value: authEnabled ? activeToken : null,
        token_delivery_method: authEnabled ? (authConfig.token_delivery?.method || deliveryType) : null,
        token_delivery_name: authEnabled ? (
          (authConfig.token_delivery?.method || deliveryType) === "header"
            ? (authConfig.token_delivery?.header_name || headerName)
            : (authConfig.token_delivery?.cookie_name || cookieName)
        ) : null,
        token_delivery_bearer: authEnabled ? (
          authConfig.token_delivery?.bearer_prefix !== undefined && authConfig.token_delivery?.bearer_prefix !== null
            ? authConfig.token_delivery.bearer_prefix
            : addBearer
        ) : null,
        path,
        method,
        payload: reqPayload
      });

      setModalTestResponse(result.data);
      const isSuccess = result.status === "success";
      setModalTestStatus(isSuccess ? "success" : "error");

      if (isSuccess) {
        if (resourceKey === "addresses") {
          const addressList = getNestedValue(result.data, parsedAddressObj.response_key);
          const addressCount = Array.isArray(addressList) ? addressList.length : (addressList ? 1 : 0);
          toast.success(`${addressCount} address${addressCount === 1 ? "" : "es"} found against key '${parsedAddressObj.response_key}'!`);
        } else {
          toast.success(`${resourceKey} endpoint test passed!`);
        }
      } else {
        toast.error(`${resourceKey} endpoint test failed.`);
      }

      setEndpointStatuses(prev => ({ ...prev, [resourceKey]: isSuccess ? "success" : "error" }));

    } catch (err) {
      setModalTestStatus("error");
      toast.error("Network error: Failed to reach testing endpoint.");
    } finally {
      setModalTestLoading(false);
    }
  };

  const handleFinish = async () => {
    toast.success("All onboarding configurations are complete and saved!");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1000);
  };

  const parsedAddressObj = useMemo(() => parseAddressPath(addrCombinedPath), [addrCombinedPath]);

  const isProductsSuccess = endpointStatuses.products === "success";
  const isOrderHistorySuccess = endpointStatuses.orderHistory === "success";
  const isCustomerProfileSuccess = endpointStatuses.customerProfile === "success";
  const isAddressesValid = (endpointStatuses.addresses === "success" || endpointStatuses.addresses === "configured") && parsedAddressObj.isValid;
  const isCreateOrderValid = (endpointStatuses.createOrder === "success" || endpointStatuses.createOrder === "configured") && coAddressIdField.trim() !== "";
  const isVerifyOrderValid = endpointStatuses.verifyOrder === "success" || endpointStatuses.verifyOrder === "configured";

  const allEndpointsSuccess =
    isProductsSuccess &&
    isOrderHistorySuccess &&
    isCustomerProfileSuccess &&
    isAddressesValid &&
    isCreateOrderValid;

  const isBankSetupValid = bankAccount.trim().length >= 8 && bankVerified;
  const isSetupComplete = isSavedToDb && allEndpointsSuccess && isBankSetupValid;

  if (pageLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-semibold text-text-secondary animate-pulse">
          Loading Onboarding Profile...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4 px-4 sm:px-6 font-sans">
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />

      <ImageCropperModal
        open={isCropperOpen}
        file={selectedLogoFile}
        aspectRatio={1}
        maxOutputSize={512}
        onCancel={() => {
          setIsCropperOpen(false);
          setSelectedLogoFile(null);
        }}
        onCropComplete={handleCropComplete}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            Connect Your Business APIs
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure your endpoint paths, authentication settings, branding, and payout account details. Changes save automatically.
          </p>
        </div>
      </div>

      {/* Part A: Shared Connection Details Card */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <span>1. Shared Connection Details</span>
            <SaveIndicator status={saveStatuses.connection} error={saveErrors.connection} />
          </div>
        }
        description="Configure your base URL and customer authentication settings. These credentials secure shopper sessions."
      >
        <div className="space-y-6">
          <Input
            label="API Base URL"
            placeholder="https://ponion-backend.onrender.com"
            value={baseUrl}
            onChange={(e) => {
              const val = e.target.value;
              setBaseUrl(val);
              triggerDebouncedAutosave("connection", { base_url: val });
            }}
            required
          />

          {/* Toggle Switch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background border border-border rounded-xl gap-4">
            <div className="flex items-center gap-3">
              {authEnabled ? (
                <Lock className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Unlock className="w-5 h-5 text-text-secondary shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Require customer authentication
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Securely validates customers via tokens before querying order histories or profiles.
                </p>
              </div>
            </div>
            <Switch
              checked={authEnabled}
              onCheckedChange={handleToggleAuth}
            />
          </div>

          {/* Customer Auth Fields */}
          {authEnabled && (
            <div className="border border-border bg-background-alt p-4 sm:p-5 rounded-xl space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm font-bold text-text-primary">Customer Authentication Setup</span>
                {authConfig.isConfigured ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success font-semibold">
                    <BadgeCheck className="w-4 h-4" /> Configured
                  </span>
                ) : (
                  <span className="text-xs text-warning font-semibold">Needs Mapping</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <Input
                    label="Customer Login Path"
                    placeholder="auth/login"
                    value={authPath}
                    onChange={(e) => {
                      const val = e.target.value.replace(/^\/+/, "");
                      setAuthPath(val);
                      triggerDebouncedAutosave("connection", {
                        auth_config: { ...authConfig, path: val }
                      });
                    }}
                    required
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Relative to your base URL — don't include the domain (e.g. <code className="bg-background px-1 py-0.5 rounded font-mono">auth/login</code>).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    HTTP Method
                  </label>
                  <select
                    value={authMethod}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAuthMethod(val);
                      handleAutosave("connection", {
                        auth_config: { ...authConfig, method: val, path: authPath }
                      });
                    }}
                    className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
              </div>

              {authConfig.isConfigured ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface border border-border rounded-lg text-sm gap-3">
                  <div className="space-y-1">
                    <p className="text-text-secondary">
                      Payload: <strong className="text-text-primary">"{authConfig.identifier_field}"</strong> ({authConfig.identifier_type}) &bull; Target: <strong className="text-text-primary">"{authConfig.token_path}"</strong>
                    </p>
                    <p className="text-text-secondary">
                      Delivery: <strong className="text-text-primary">{authConfig.token_delivery?.method === "header" ? `Header (${authConfig.token_delivery?.header_name || "Authorization"})` : `Cookie (${authConfig.token_delivery?.cookie_name || "session"})`}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMappingStep(1);
                      setShowMappingModal(true);
                    }}
                    className="text-primary hover:underline font-semibold flex items-center gap-1 text-xs cursor-pointer shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Configuration
                  </button>
                </div>
              ) : (
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setMappingStep(1);
                      setShowMappingModal(true);
                    }}
                    disabled={authPath.trim() === ""}
                    className="flex items-center gap-2"
                  >
                    <span>Map Login Fields</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Widget Branding & Webhook Settings */}
          <div className="border border-border bg-background p-4 sm:p-5 rounded-xl space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-bold text-text-primary">Widget Branding & Webhooks</span>
              <SaveIndicator status={saveStatuses.branding} error={saveErrors.branding} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Accent Color Picker */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Accent Color Theme (Hex)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorTheme || "#4338CA"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setColorTheme(val);
                      handleAutosave("branding", {
                        branding_config: { brand_color: val, logo_url: logoUrl }
                      });
                    }}
                    className="w-11 h-11 border border-border rounded-lg cursor-pointer bg-surface p-1 shrink-0"
                  />
                  <div className="flex-1">
                    <Input
                      value={(colorTheme || "").toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColorTheme(val);
                        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                          triggerDebouncedAutosave("branding", {
                            branding_config: { brand_color: val, logo_url: logoUrl }
                          });
                        }
                      }}
                      placeholder="#4338CA"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Widget Logo Upload UI */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Widget Logo
                </label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="relative w-16 h-16 rounded-xl border border-border bg-surface flex items-center justify-center overflow-hidden cursor-pointer group shrink-0"
                    >
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-secondary/70 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <UploadCloud className="w-5 h-5" />
                        <span className="text-[9px] font-bold mt-0.5">Change</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center text-text-secondary hover:text-primary hover:border-primary transition-colors cursor-pointer shrink-0"
                      role="button"
                    >
                      {isLogoUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      ) : (
                        <>
                          <UploadCloud className="w-6 h-6" />
                          <span className="text-[10px] font-semibold mt-1">Upload</span>
                        </>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {logoUrl ? "Custom Logo Active" : "Default Avatar Active"}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Supports PNG, JPG, WEBP, SVG. Crop to 1:1 square ratio.
                    </p>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl("");
                          handleAutosave("branding", {
                            branding_config: { brand_color: colorTheme, logo_url: null }
                          });
                        }}
                        className="text-error hover:underline text-xs font-semibold mt-1 block cursor-pointer"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Input
                label="Merchant Webhook Path"
                placeholder="webhook/merchant-os"
                value={webhookPath}
                onChange={(e) => {
                  const val = e.target.value.replace(/^\/+/, "");
                  setWebhookPath(val);
                  triggerDebouncedAutosave("branding", { webhook_path: val });
                }}
              />
              <p className="text-xs text-text-secondary mt-1">
                Relative to your base URL — don't include the domain (e.g. <code className="bg-surface px-1 py-0.5 rounded font-mono">webhook/merchant-os</code>).
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Part B: Endpoints Mapping Card */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <span>2. Resource Endpoints</span>
            <SaveIndicator status={saveStatuses.endpoints} error={saveErrors.endpoints} />
          </div>
        }
        description="Verify connection details for individual resource paths. Configure and test each endpoint below."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 animate-fade-in">
          {/* Products Card */}
          <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between min-h-[180px] shadow-xs hover:border-primary transition-all">
            <div>
              <span className="text-sm font-bold text-text-primary block">Products Catalog</span>
              <div className="mt-1.5 mb-2.5">
                <StatusBadge status={endpointStatuses.products} size="sm" />
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Path: <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{prodPath}</code>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenResourceModal("products")}
              className="w-full justify-center mt-4"
            >
              Configure & Test
            </Button>
          </div>

          {/* Order History Card */}
          <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between min-h-[180px] shadow-xs hover:border-primary transition-all">
            <div>
              <span className="text-sm font-bold text-text-primary block">Order History</span>
              <div className="mt-1.5 mb-2.5">
                <StatusBadge status={endpointStatuses.orderHistory} size="sm" />
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Path: <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{ohPath}</code>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenResourceModal("orderHistory")}
              className="w-full justify-center mt-4"
            >
              Configure & Test
            </Button>
          </div>

          {/* Customer Profile Card */}
          <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between min-h-[180px] shadow-xs hover:border-primary transition-all">
            <div>
              <span className="text-sm font-bold text-text-primary block">Customer Profile</span>
              <div className="mt-1.5 mb-2.5">
                <StatusBadge status={endpointStatuses.customerProfile} size="sm" />
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Path: <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{cpPath}</code>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenResourceModal("customerProfile")}
              className="w-full justify-center mt-4"
            >
              Configure & Test
            </Button>
          </div>

          {/* Addresses Card */}
          <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between min-h-[180px] shadow-xs hover:border-primary transition-all">
            <div>
              <span className="text-sm font-bold text-text-primary block">Customer Addresses</span>
              <div className="mt-1.5 mb-2.5">
                <StatusBadge status={endpointStatuses.addresses} size="sm" />
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Dot-path: <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{addrCombinedPath}</code>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenResourceModal("addresses")}
              className="w-full justify-center mt-4"
            >
              Configure & Test
            </Button>
          </div>

          {/* Create Order Card */}
          <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between min-h-[180px] shadow-xs hover:border-primary transition-all">
            <div>
              <span className="text-sm font-bold text-text-primary block">Create Order</span>
              <div className="mt-1.5 mb-2.5">
                <StatusBadge status={endpointStatuses.createOrder} size="sm" />
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Path: <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{coPath}</code>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenResourceModal("createOrder")}
              className="w-full justify-center mt-4"
            >
              Configure & Test
            </Button>
          </div>

          {/* Verify Order Amount Card */}
          <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between min-h-[180px] shadow-xs hover:border-primary transition-all">
            <div>
              <span className="text-sm font-bold text-text-primary block">Verify Order Amount</span>
              <div className="mt-1.5 mb-2.5">
                <StatusBadge status={endpointStatuses.verifyOrder} size="sm" />
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Path: <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{voPath}</code>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenResourceModal("verifyOrder")}
              className="w-full justify-center mt-4"
            >
              Configure & Test
            </Button>
          </div>
        </div>
      </Card>

      {/* Part C: Settlement Bank Target */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <span>3. Settlement Bank Account</span>
            <SaveIndicator status={saveStatuses.settlement} error={saveErrors.settlement} />
          </div>
        }
        description="Provide your business deposit details to route payouts from Razorpay transaction completions."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Bank Account Number"
              type="text"
              placeholder="09280192839128"
              value={bankAccount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setBankAccount(val);
                triggerDebouncedAutosave("settlement", { bank_account: val });
              }}
              required
            />

            <div className="relative">
              <Input
                label="IFSC Code"
                type="text"
                placeholder="HDFC0000261"
                value={ifsc}
                onChange={(e) => handleIfscLookup(e.target.value)}
                maxLength={11}
                error={ifscError}
                required
              />
              {bankLoading && (
                <span className="absolute right-3 top-9 text-xs text-text-secondary animate-pulse">
                  Validating...
                </span>
              )}
            </div>
          </div>

          {bankVerified && resolvedBank && (
            <div className="p-4 border border-success/20 bg-success/5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <Landmark className="w-6 h-6 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-text-primary">
                    {resolvedBank}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Branch: {resolvedBranch} &bull; Route Verified
                  </p>
                </div>
              </div>
              <StatusBadge status="success" message="Branch Active" />
            </div>
          )}
        </div>
      </Card>

      {/* Complete Setup Action Banner */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {isSetupComplete ? (
              <BadgeCheck className="w-8 h-8 text-success shrink-0" />
            ) : (
              <Database className="w-8 h-8 text-text-secondary shrink-0" />
            )}
            <div>
              <p className="font-semibold text-text-primary">
                {isSetupComplete ? "All Integration Rules Met" : "Autosaving Setup Progress"}
              </p>
              <p className="text-xs text-text-secondary">
                {isSetupComplete
                  ? "Your endpoints, credentials, and settlement bank have been verified successfully."
                  : "Endpoints and payout bank account details auto-save immediately as you type."}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleFinish}
            disabled={!isSetupComplete}
            className="flex items-center gap-2 shadow-xs min-w-[140px] justify-center"
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>Finish Setup</span>
          </Button>
        </div>
      </Card>

      {/* INTERCEPT MODAL: Disable customer auth warning */}
      {showConfirmDisableModal && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-surface max-w-md w-full rounded-2xl border-2 border-error p-6 shadow-2xl relative">
            <button
              onClick={() => setShowConfirmDisableModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-error mb-4">
              <div className="p-2 bg-error/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-error" />
              </div>
              <h3 className="font-heading text-lg font-bold text-error">
                Disable customer authentication?
              </h3>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              Without authentication, the AI agent <b>cannot securely identify customers</b>, <b>cannot show order history</b>, and <b>cannot restrict access</b> to customer data.
            </p>

            <div className="flex flex-col gap-2.5">
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowConfirmDisableModal(false)}
                className="w-full justify-center"
              >
                Cancel (Keep Secure)
              </Button>
              <button
                type="button"
                onClick={confirmDisableAuth}
                className="w-full py-2.5 rounded-lg text-sm font-semibold border border-error/30 text-error hover:bg-error hover:text-white transition-colors cursor-pointer"
              >
                I understand the risk, disable authentication
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAPPING STEP-MODAL */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-2xl w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between bg-background-alt shrink-0">
              <div>
                <h3 className="font-heading text-lg font-bold text-text-primary">
                  Map Login & Token Settings
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Configure payload shapes and token delivery rules.
                </p>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-border bg-surface flex items-center justify-between shrink-0 text-xs font-semibold select-none">
              {[
                { step: 1, label: "Payload Mapping" },
                { step: 2, label: "Test API Path" },
                { step: 3, label: "Token Path" },
                { step: 4, label: "Token Delivery" }
              ].map((s) => (
                <div
                  key={s.step}
                  className={`flex items-center gap-1.5 ${mappingStep === s.step
                    ? "text-primary"
                    : mappingStep > s.step
                      ? "text-success"
                      : "text-text-secondary"
                    }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${mappingStep === s.step
                    ? "border-primary bg-primary-light"
                    : mappingStep > s.step
                      ? "border-success bg-success/10 text-success"
                      : "border-border"
                    }`}>
                    {mappingStep > s.step ? <Check className="w-3 h-3" /> : s.step}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans">
              {mappingStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Configure Payload Parameters</h4>
                    <p className="text-xs text-text-secondary">
                      Specify JSON field keys expected during customer login requests.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Identifier JSON Key"
                      placeholder="e.g. email or username"
                      value={modalIdentifierField}
                      onChange={(e) => setModalIdentifierField(e.target.value)}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">
                        Identifier Format
                      </label>
                      <select
                        value={modalIdentifierType}
                        onChange={(e) => setModalIdentifierType(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
                      >
                        <option value="Email">Email Address</option>
                        <option value="Mobile">Mobile / Phone Number</option>
                        <option value="Text">General Username / Text</option>
                      </select>
                    </div>
                  </div>

                  <Input
                    label="Password JSON Key"
                    placeholder="e.g. password"
                    value={modalPasswordField}
                    onChange={(e) => setModalPasswordField(e.target.value)}
                    required
                  />

                  <div className="flex justify-end pt-4">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleSaveMappingStep1}
                    >
                      Save & Next
                    </Button>
                  </div>
                </div>
              )}

              {mappingStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Send Test Credentials</h4>
                    <p className="text-xs text-text-secondary">
                      Provide temporary credentials to test customer login against your path: <code className="bg-background px-1 py-0.5 rounded font-mono">{authPath}</code>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label={`Test ${modalIdentifierType} Value`}
                      placeholder={modalIdentifierType === "Email" ? "demo@email.com" : "demo_user"}
                      value={testIdentifierValue}
                      onChange={(e) => setTestIdentifierValue(e.target.value)}
                      required
                    />
                    <Input
                      label="Test Password Value"
                      type="password"
                      placeholder="••••••••"
                      value={testPasswordValue}
                      onChange={(e) => setTestPasswordValue(e.target.value)}
                      required
                    />
                  </div>

                  {testResponseData && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-text-secondary uppercase">
                        Raw Response JSON
                      </label>
                      <pre className="p-4 bg-background border border-border rounded-xl text-xs font-mono text-text-primary max-h-48 overflow-auto select-all">
                        {JSON.stringify(testResponseData, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMappingStep(1)}
                    >
                      Back
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleTestCustomerAuth}
                        disabled={testLoading || !testIdentifierValue || !testPasswordValue}
                        className="flex items-center gap-2"
                      >
                        {testLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <span>Send Test Request</span>
                        )}
                      </Button>
                      {testResponseData && (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => setMappingStep(3)}
                        >
                          Next Step
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {mappingStep === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Extract Token Path</h4>
                    <p className="text-xs text-text-secondary">
                      Specify the path inside the JSON response where the session token resides.
                    </p>
                  </div>

                  <div className="relative">
                    <Input
                      label="Token Path (Dot-notation)"
                      placeholder="e.g. token or data.access_token"
                      value={tokenPath}
                      onChange={(e) => setTokenPath(e.target.value)}
                      required
                    />

                    <div className="absolute right-3 top-8.5">
                      {tokenPathStatus === "success" && (
                        <span className="inline-flex items-center gap-1 text-xs text-success font-semibold bg-success/10 px-2.5 py-1 rounded-full border border-success/20 animate-fade-in">
                          <Check className="w-3.5 h-3.5" /> Resolves to Value
                        </span>
                      )}
                      {tokenPathStatus === "error" && (
                        <span className="inline-flex items-center gap-1 text-xs text-error font-semibold bg-error/10 px-2.5 py-1 rounded-full border border-error/20 animate-fade-in">
                          <X className="w-3.5 h-3.5" /> Unresolvable Path
                        </span>
                      )}
                    </div>
                  </div>

                  {testResponseData && (
                    <div className="p-4 bg-background border border-border rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-text-secondary uppercase block">
                        Resolved Value Preview:
                      </span>
                      <p className="font-mono text-sm break-all text-text-primary">
                        {tokenPathStatus === "success"
                          ? String(getNestedValue(testResponseData, tokenPath))
                          : "—"}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMappingStep(2)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setMappingStep(4)}
                      disabled={tokenPathStatus !== "success"}
                    >
                      Next Step
                    </Button>
                  </div>
                </div>
              )}

              {mappingStep === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Token Delivery Method</h4>
                    <p className="text-xs text-text-secondary">
                      Choose how customer auth tokens are attached to subsequent resource requests.
                    </p>
                  </div>

                  <div className="flex gap-4 p-1 bg-background border border-border rounded-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setDeliveryType("header")}
                      className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-colors cursor-pointer ${deliveryType === "header"
                        ? "bg-surface text-text-primary shadow-xs font-bold"
                        : "text-text-secondary hover:text-text-primary"
                        }`}
                    >
                      Request Header
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType("cookie")}
                      className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-colors cursor-pointer ${deliveryType === "cookie"
                        ? "bg-surface text-text-primary shadow-xs font-bold"
                        : "text-text-secondary hover:text-text-primary"
                        }`}
                    >
                      Browser Cookie
                    </button>
                  </div>

                  {deliveryType === "header" ? (
                    <div className="space-y-6 animate-fade-in">
                      <Input
                        label="HTTP Header Name"
                        placeholder="Authorization"
                        value={headerName}
                        onChange={(e) => setHeaderName(e.target.value)}
                        required
                      />

                      <div className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            Add 'Bearer ' Prefix?
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Pre-appends token string values (e.g. Bearer JWT_TOKEN).
                          </p>
                        </div>
                        <Switch
                          checked={addBearer}
                          onCheckedChange={setAddBearer}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade-in">
                      <Input
                        label="Cookie Name"
                        placeholder="session"
                        value={cookieName}
                        onChange={(e) => setCookieName(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMappingStep(3)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={saveFullAuthConfig}
                    >
                      Save Auth Configuration
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCOPED RESOURCE MODAL */}
      {activeResource && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-2xl w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between bg-background-alt shrink-0">
              <div>
                <h3 className="font-heading text-lg font-bold text-text-primary">
                  Configure {activeResource === "products" ? "Products API" :
                    activeResource === "orderHistory" ? "Order History API" :
                      activeResource === "customerProfile" ? "Customer Profile API" :
                        activeResource === "addresses" ? "Customer Addresses API" :
                          activeResource === "createOrder" ? "Create Order API" : "Verify Order Amount API"}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Configure specific resource properties and verify real API responses.
                </p>
              </div>
              <button
                onClick={() => setActiveResource(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans">
              {authEnabled && (
                <div className="p-4 bg-background border border-border rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-primary" /> Active Test Auth Token
                    </span>
                    {sessionToken ? (
                      <span className="text-[10px] text-success font-bold bg-success/10 px-2 py-0.5 rounded border border-success/20">
                        Token Active ✓
                      </span>
                    ) : (
                      <span className="text-[10px] text-warning font-bold bg-warning/10 px-2 py-0.5 rounded border border-warning/20">
                        No Token Set
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Paste test customer JWT / session token..."
                      value={sessionToken || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSessionToken(val);
                        if (typeof window !== "undefined") {
                          sessionStorage.setItem("test_session_token", val);
                        }
                      }}
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    {!sessionToken && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveResource(null);
                          setMappingStep(1);
                          setShowMappingModal(true);
                        }}
                        className="px-3 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                      >
                        Run Login Test
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Sent during live test as:{" "}
                    <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-[11px]">
                      {(authConfig.token_delivery?.method || deliveryType) === "cookie"
                        ? `Cookie: ${authConfig.token_delivery?.cookie_name || cookieName}=<token>`
                        : `Header: ${authConfig.token_delivery?.header_name || headerName}: ${authConfig.token_delivery?.bearer_prefix !== false ? "Bearer " : ""}<token>`}
                    </code>
                  </p>
                </div>
              )}

              {activeResource === "products" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <Input
                      label="Endpoint Path (Relative to base URL)"
                      placeholder="products"
                      value={prodPath}
                      onChange={(e) => setProdPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Search Query Param Key"
                      placeholder="query"
                      value={prodPayloadKey}
                      onChange={(e) => setProdPayloadKey(e.target.value)}
                      required
                    />
                    <Input
                      label="Results Array Path"
                      placeholder="products"
                      value={prodResponseKey}
                      onChange={(e) => setProdResponseKey(e.target.value)}
                      required
                    />
                  </div>

                  <div className="border-t border-border pt-4 space-y-4">
                    <span className="text-xs font-bold text-text-secondary uppercase">API Route Validation</span>
                    <Input
                      label="Sample Keyword Search Term"
                      placeholder="laptop"
                      value={prodTestTerm}
                      onChange={(e) => setProdTestTerm(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {activeResource === "orderHistory" && (() => {
                const ordersArray = modalTestResponse ? resolveArrayAt(modalTestResponse, ohArrayPath) : null;
                const sampleOrder = ordersArray && ordersArray.length > 0 ? ordersArray[0] : null;

                return (
                  <div className="space-y-6 animate-fade-in">
                    <Input
                      label="Fetch Path (Relative to base URL)"
                      placeholder="orders/history"
                      value={ohPath}
                      onChange={(e) => setOhPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />

                    <div>
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                        <label className="block text-xs font-semibold text-text-primary">
                          Orders List Array Path *
                        </label>
                        {modalTestResponse && ohArrayPath.trim() !== "" && (
                          <span className="text-[11px] font-mono font-medium">
                            {ordersArray !== null ? (
                              <span className="text-emerald-400">
                                ✓ Array found — {ordersArray.length} {ordersArray.length === 1 ? "item" : "items"}
                              </span>
                            ) : (
                              <span className="text-amber-400/80 italic">No array found at "{ohArrayPath}"</span>
                            )}
                          </span>
                        )}
                      </div>
                      <Input
                        placeholder="e.g. data.orders or orders"
                        value={ohArrayPath}
                        onChange={(e) => setOhArrayPath(e.target.value)}
                        required
                      />
                      <p className="text-xs text-text-secondary mt-1">
                        Dot-path pointing to the array of order objects in your response JSON.
                      </p>
                    </div>

                    <DynamicFieldMappings
                      mappings={ohFieldMappings}
                      onChange={setOhFieldMappings}
                      previewSampleItem={sampleOrder}
                      title="Order Field Mappings"
                      description="Map standard fields (ID, Name, Price, Quantity) or custom fields relative to each item in the orders array."
                    />
                  </div>
                );
              })()}

              {activeResource === "customerProfile" && (() => {
                const profileTargetObj = cpResponseObjectPath.trim() ? resolvePath(modalTestResponse, cpResponseObjectPath) : modalTestResponse;
                const sampleProfileItem = profileTargetObj && typeof profileTargetObj === "object" ? profileTargetObj : modalTestResponse;

                return (
                  <div className="space-y-6 animate-fade-in">
                    <Input
                      label="Fetch Path (Relative to base URL)"
                      placeholder="customers"
                      value={cpPath}
                      onChange={(e) => setCpPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />

                    <Input
                      label="Response Object Path (Optional)"
                      placeholder="e.g. data or data.user"
                      value={cpResponseObjectPath}
                      onChange={(e) => setCpResponseObjectPath(e.target.value)}
                    />
                    <p className="text-xs text-text-secondary -mt-4">
                      Optional dot-path to the profile object in your response JSON.
                    </p>

                    <DynamicFieldMappings
                      mappings={cpFieldMappings}
                      onChange={setCpFieldMappings}
                      previewSampleItem={sampleProfileItem}
                      title="Customer Profile Field Mappings"
                      description="All profile fields (Name, Email, Phone, Loyalty Tier) are optional. Omitted/blank paths resolve gracefully to None."
                    />
                  </div>
                );
              })()}

              {activeResource === "addresses" && (() => {
                const parsedAddr = parseAddressPath(addrCombinedPath);
                const addrsArray = modalTestResponse && parsedAddr.isValid ? resolveArrayAt(modalTestResponse, parsedAddr.response_key) : null;
                const sampleAddr = addrsArray && addrsArray.length > 0 ? addrsArray[0] : null;
                const resolvedDisplay = sampleAddr && addrDisplayField.trim() ? resolvePath(sampleAddr, addrDisplayField) : null;

                return (
                  <div className="space-y-6 animate-fade-in">
                    <div className="p-4 bg-background border border-border rounded-xl space-y-3">
                      <label className="block text-sm font-bold text-text-primary">
                        Should the agent be able to add new delivery addresses for customers during checkout?
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAddrSupportsCreation(false);
                            setAddrActiveTab("fetch");
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${!addrSupportsCreation
                            ? "bg-primary text-white border-primary"
                            : "bg-surface text-text-secondary border-border hover:text-text-primary"
                            }`}
                        >
                          No (Existing saved addresses only)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddrSupportsCreation(true);
                            setAddrActiveTab("create");
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${addrSupportsCreation
                            ? "bg-primary text-white border-primary"
                            : "bg-surface text-text-secondary border-border hover:text-text-primary"
                            }`}
                        >
                          Yes (Allow agent to add new addresses)
                        </button>
                      </div>
                    </div>

                    {addrSupportsCreation && (
                      <div className="flex gap-4 p-1 bg-background border border-border rounded-xl shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAddrActiveTab("fetch");
                            setModalTestResponse(null);
                            setModalTestStatus("untested");
                          }}
                          className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-colors cursor-pointer ${addrActiveTab === "fetch"
                            ? "bg-surface text-text-primary shadow-xs font-bold"
                            : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                          Fetch Operation (GET) - Read
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddrActiveTab("create");
                            setModalTestResponse(null);
                            setModalTestStatus("untested");
                          }}
                          className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-colors cursor-pointer ${addrActiveTab === "create"
                            ? "bg-surface text-text-primary shadow-xs font-bold"
                            : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                          Create Operation (POST) - Write
                        </button>
                      </div>
                    )}

                    {addrActiveTab === "fetch" || !addrSupportsCreation ? (
                      <div className="space-y-6 animate-fade-in">
                        <Input
                          label="Fetch Path (Relative to base URL)"
                          placeholder="users/addresses"
                          value={addrFetchPath}
                          onChange={(e) => setAddrFetchPath(e.target.value.replace(/^\/+/, ""))}
                          required
                        />

                        <div>
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                            <label className="block text-xs font-semibold text-text-primary">
                              Addresses Path (Array Path + ID Field) *
                            </label>
                            {modalTestResponse && addrCombinedPath.trim() !== "" && (
                              <span className="text-[11px] font-mono font-medium">
                                {addrsArray !== null ? (
                                  <span className="text-emerald-400">
                                    ✓ Array found — {addrsArray.length} {addrsArray.length === 1 ? "address" : "addresses"} (ID field: "{parsedAddr.id_field}")
                                  </span>
                                ) : (
                                  <span className="text-amber-400/80 italic">No addresses array found</span>
                                )}
                              </span>
                            )}
                          </div>
                          <Input
                            placeholder="e.g. data.addresses._id or addresses.id"
                            value={addrCombinedPath}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAddrCombinedPath(val);
                              const parsed = parseAddressPath(val);
                              if (parsed.isValid) {
                                setAddrFetchResponseKey(parsed.response_key);
                                setAddrFetchIdField(parsed.id_field);
                              }
                            }}
                            required
                            error={!parsedAddr.isValid ? "Must be a dot-path ending with ID field (e.g. 'data.addresses._id')" : undefined}
                          />
                          <p className="text-xs text-text-secondary mt-1">
                            Combined dot-path to your addresses array with the ID field as the last segment (e.g. <code className="bg-background px-1 py-0.5 rounded font-mono">data.addresses._id</code>).
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                            <label className="block text-xs font-semibold text-text-primary">
                              Address Display Field (Optional)
                            </label>
                            {sampleAddr && addrDisplayField.trim() !== "" && (
                              <span className="text-[11px] font-mono font-medium">
                                Preview:{" "}
                                {resolvedDisplay !== null && resolvedDisplay !== undefined ? (
                                  <span className="text-emerald-400">{String(resolvedDisplay)}</span>
                                ) : (
                                  <span className="text-amber-400/80 italic">No value found</span>
                                )}
                              </span>
                            )}
                          </div>
                          <Input
                            placeholder="e.g. address or formattedAddress"
                            value={addrDisplayField}
                            onChange={(e) => setAddrDisplayField(e.target.value)}
                          />
                          <p className="text-xs text-text-secondary mt-1">
                            Dot-path relative to each address object for human-readable display string (e.g. <code className="bg-background px-1 py-0.5 rounded font-mono">formattedAddress</code>).
                          </p>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-6 animate-fade-in">
                      <Input
                        label="Create Path (Relative to base URL)"
                        placeholder="addresses"
                        value={addrCreatePath}
                        onChange={(e) => setAddrCreatePath(e.target.value.replace(/^\/+/, ""))}
                        required
                      />

                      <div>
                        <Input
                          label="Required JSON Keys (Comma separated)"
                          placeholder="line1, line2, city, state, pincode"
                          value={addrCreateFields}
                          onChange={(e) => {
                            setAddrCreateFields(e.target.value);
                            const keys = e.target.value.split(",").map(k => k.trim()).filter(Boolean);
                            const dynamicInputs: Record<string, string> = {};
                            keys.forEach(k => {
                              dynamicInputs[k] = addrCreateTestInputs[k] || "";
                            });
                            setAddrCreateTestInputs(dynamicInputs);
                          }}
                          required
                        />
                      </div>

                      <div className="border-t border-border pt-4 bg-background p-4 rounded-xl space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={addrSelfCertified}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setAddrSelfCertified(checked);
                              setEndpointStatuses(prev => ({
                                ...prev,
                                addresses: checked ? "configured" : (addrFetchTested ? "success" : "untested")
                              }));
                            }}
                            className="mt-1 w-4 h-4 text-primary rounded border-border focus:ring-primary cursor-pointer"
                          />
                          <div>
                            <span className="text-sm font-semibold text-text-primary">
                              I confirm this endpoint is configured correctly and will accept requests in the documented shape.
                            </span>
                            <p className="text-xs text-text-secondary mt-0.5">
                              Self-certifying avoids executing live address creation writes against your database during onboarding.
                            </p>
                          </div>
                        </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

              {activeResource === "createOrder" && (
                <div className="space-y-6 animate-fade-in">
                  <Input
                    label="Endpoint Path (Relative to base URL)"
                    placeholder="orders"
                    value={coPath}
                    onChange={(e) => setCoPath(e.target.value.replace(/^\/+/, ""))}
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Cart Wrapper Key"
                      placeholder="cart"
                      value={coCartKey}
                      onChange={(e) => setCoCartKey(e.target.value)}
                      required
                    />
                    <Input
                      label="Item ID Key Name"
                      placeholder="item_id"
                      value={coItemIdField}
                      onChange={(e) => setCoItemIdField(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Price Key Name"
                      placeholder="price"
                      value={coPriceField}
                      onChange={(e) => setCoPriceField(e.target.value)}
                      required
                    />
                    <Input
                      label="Quantity Key Name"
                      placeholder="quantity"
                      value={coQuantityField}
                      onChange={(e) => setCoQuantityField(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Input
                      label="Address ID Key Name *"
                      placeholder="address_id"
                      value={coAddressIdField}
                      onChange={(e) => setCoAddressIdField(e.target.value)}
                      required
                    />
                  </div>

                  {/* Verify Order Amount Inline Config Group */}
                  <div className="border-t border-border pt-6 space-y-4 bg-background p-4 rounded-xl">
                    <div>
                      <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <span>Verify Order Amount Setup</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold">Safety Check</span>
                      </h4>
                      <p className="text-xs text-text-secondary mt-1">
                        Used to independently confirm the exact amount to charge for an order, right before payment — a safety check against the create-order response alone.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Verify Endpoint Path"
                        placeholder="user/payments"
                        value={voPath}
                        onChange={(e) => setVoPath(e.target.value.replace(/^\/+/, ""))}
                      />
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1.5">
                          Method
                        </label>
                        <select
                          value={voMethod}
                          onChange={(e) => setVoMethod(e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Order ID Body Key"
                        placeholder="merchantOrderId"
                        value={voOrderIdField}
                        onChange={(e) => setVoOrderIdField(e.target.value)}
                      />
                      <Input
                        label="Response Price Key"
                        placeholder="price"
                        value={voResponsePriceField}
                        onChange={(e) => setVoResponsePriceField(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 bg-background p-4 rounded-xl space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={coSelfCertified}
                        onChange={(e) => {
                          if (!coAddressIdField.trim()) {
                            toast.error("Address ID key name is required before self-certifying.");
                            return;
                          }
                          const checked = e.target.checked;
                          setCoSelfCertified(checked);
                          setEndpointStatuses(prev => ({
                            ...prev,
                            createOrder: checked ? "configured" : "untested"
                          }));
                        }}
                        className="mt-1 w-4 h-4 text-primary rounded border-border focus:ring-primary cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-semibold text-text-primary">
                          I confirm this endpoint is configured correctly and will accept requests in the documented shape.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {activeResource === "verifyOrder" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Verify Order Amount Endpoint</h4>
                    <p className="text-xs text-text-secondary mt-1">
                      Used to independently confirm the exact amount to charge for an order, right before payment — a safety check against the create-order response alone.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Endpoint Path (Relative to base URL)"
                      placeholder="user/payments"
                      value={voPath}
                      onChange={(e) => setVoPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">
                        HTTP Method
                      </label>
                      <select
                        value={voMethod}
                        onChange={(e) => setVoMethod(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
                      >
                        <option value="POST">POST</option>
                        <option value="GET">GET</option>
                        <option value="PUT">PUT</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Order ID Body Key"
                      placeholder="merchantOrderId"
                      value={voOrderIdField}
                      onChange={(e) => setVoOrderIdField(e.target.value)}
                      required
                    />
                    <Input
                      label="Response Price Key"
                      placeholder="price"
                      value={voResponsePriceField}
                      onChange={(e) => setVoResponsePriceField(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {modalTestResponse && (
                <div className="space-y-3 border-t border-border pt-6 animate-fade-in font-sans">
                  {activeResource === "addresses" && modalTestStatus === "success" && (() => {
                    const parsed = parseAddressPath(addrCombinedPath);
                    const addressList = resolveArrayAt(modalTestResponse, parsed.response_key);
                    const count = Array.isArray(addressList) ? addressList.length : (addressList ? 1 : 0);
                    return (
                      <div className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in ${
                        count > 0 ? "bg-success/10 border-success/30" : "bg-warning/10 border-warning/30"
                      }`}>
                        {count > 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className={`text-sm font-bold ${count > 0 ? "text-success" : "text-warning"}`}>
                            {count > 0 ? "Key Configuration Verified!" : `No Addresses Found Under Key '${parsed.response_key}'`}
                          </h4>
                          <p className="text-xs text-text-primary mt-1">
                            <strong className="font-bold">{count} address{count === 1 ? "" : "es"}</strong> found against your key <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{parsed.response_key}</code>.
                          </p>
                          {count > 0 && Array.isArray(addressList) && addressList[0] && parsed.id_field && (
                            <p className="text-[11px] text-text-secondary mt-1">
                              ID Key (<code className="bg-background px-1 py-0.5 rounded font-mono">{parsed.id_field}</code>):{" "}
                              <strong className="text-text-primary font-mono">{String(resolvePath(addressList[0], parsed.id_field) ?? addressList[0]._id ?? addressList[0].id ?? "verified")}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-text-secondary uppercase">
                      Raw Response JSON
                    </label>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold ${modalTestStatus === "success" ? "text-success bg-success/10 border border-success/20" : "text-error bg-error/10 border border-error/20"
                      }`}>
                      {modalTestStatus === "success" ? "200 Success" : "Error Response"}
                    </span>
                  </div>
                  <pre className="p-4 bg-background border border-border rounded-xl text-xs font-mono text-text-primary max-h-48 overflow-auto select-all">
                    {JSON.stringify(modalTestResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border flex items-center justify-between bg-background-alt shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveResource(null)}
              >
                Close
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleSaveAndTestResource(activeResource)}
                  disabled={modalTestLoading}
                  className="flex items-center gap-1.5"
                >
                  {modalTestLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>Live Test</span>
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    const parsedAddrCheck = parseAddressPath(addrCombinedPath);
                    if (activeResource === "addresses" && !parsedAddrCheck.isValid) {
                      toast.error("Address path must be formatted as 'data.addresses._id' or 'addresses.id'");
                      return;
                    }

                    // Save resource state via autosave
                    let patchData: Partial<OnboardingData> = {};
                    if (activeResource === "products") {
                      patchData.products_config = { path: prodPath, method: "GET", payload_key: prodPayloadKey, response_key: prodResponseKey };
                    } else if (activeResource === "orderHistory") {
                      const fieldMappingDict: Record<string, string> = {};
                      ohFieldMappings.forEach((m) => {
                        if (m.key.trim() && m.path.trim()) {
                          fieldMappingDict[m.key.trim()] = m.path.trim();
                        }
                      });
                      patchData.order_history_config = {
                        path: ohPath,
                        method: "GET",
                        array_path: ohArrayPath,
                        response_key: ohArrayPath,
                        field_mapping: fieldMappingDict,
                        fields: fieldMappingDict,
                      };
                    } else if (activeResource === "customerProfile") {
                      const fieldMappingDict: Record<string, string> = {};
                      cpFieldMappings.forEach((m) => {
                        if (m.key.trim() && m.path.trim()) {
                          fieldMappingDict[m.key.trim()] = m.path.trim();
                        }
                      });
                      patchData.customer_profile_config = {
                        path: cpPath,
                        method: "GET",
                        response_object_path: cpResponseObjectPath,
                        response_key: cpResponseObjectPath,
                        field_mapping: fieldMappingDict,
                      };
                    } else if (activeResource === "addresses") {
                      patchData.addresses_config = {
                        supports_creation: addrSupportsCreation,
                        fetch: {
                          path: addrFetchPath,
                          method: "GET",
                          response_path: addrCombinedPath,
                          response_key: parsedAddrCheck.response_key,
                          id_field: parsedAddrCheck.id_field,
                          display_field: addrDisplayField,
                        },
                        create: addrSupportsCreation ? { path: addrCreatePath, method: "POST", field_mapping: addrCreateFields.split(",").map(k => k.trim()).filter(Boolean) } : null
                      };
                    } else if (activeResource === "createOrder") {
                      patchData.create_order_config = {
                        path: coPath,
                        method: "POST",
                        cart_key: coCartKey,
                        item_id_field: coItemIdField,
                        price_field: coPriceField,
                        quantity_field: coQuantityField,
                        address_id_field: coAddressIdField,
                        additional_fields: coAdditionalFields.filter(f => f.key.trim() !== "")
                      };
                      patchData.verify_order_config = {
                        path: voPath,
                        method: voMethod,
                        order_id_field: voOrderIdField,
                        response_price_field: voResponsePriceField
                      };
                    } else if (activeResource === "verifyOrder") {
                      patchData.verify_order_config = {
                        path: voPath,
                        method: voMethod,
                        order_id_field: voOrderIdField,
                        response_price_field: voResponsePriceField
                      };
                    }

                    handleAutosave("endpoints", patchData);
                    setActiveResource(null);
                    toast.success("Endpoint configuration updated.");
                  }}
                >
                  Save & Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
