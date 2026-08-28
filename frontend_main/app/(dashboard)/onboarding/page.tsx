"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  UploadCloud
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { fetchOnboardingDetails, saveOnboardingDetails, testEndpoint, testCustomerAuth } from "@/lib/api/onboarding";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn: authSignedIn } = useAuth();

  // Loading and saving states
  const [pageLoading, setPageLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSavedToDb, setIsSavedToDb] = useState(false); // Step 1 Lock/Unlock gating state

  // Edit & Change Tracking States
  const [isEditing, setIsEditing] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<any>(null);

  // Branding & Webhook States
  const [colorTheme, setColorTheme] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  // Modals state
  const [showConfirmDisableModal, setShowConfirmDisableModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingStep, setMappingStep] = useState(1); // 1 | 2 | 3 | 4
  const [activeResource, setActiveResource] = useState<string | null>(null); // "products" | "orderHistory" | "customerProfile" | "addresses" | "createOrder" | null

  // Active Session Token (tested in Step 1, reused in Step 2)
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Part A: Shared Connection Details State
  const [baseUrl, setBaseUrl] = useState("https://api.acmestore.com/v1");
  const [authEnabled, setAuthEnabled] = useState(true);
  const [authDisabledAck, setAuthDisabledAck] = useState(false);
  const [authUrl, setAuthUrl] = useState("https://api.acmestore.com/v1/auth/login");
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

  // Part B: Endpoints Mapping State (Scoped fields stored here)
  const [endpoints, setEndpoints] = useState<any>({
    products: { path: "products", method: "GET", payload_key: "query", response_key: "products" },
    orderHistory: { path: "orders/history", method: "GET", response_key: "orders" },
    customerProfile: { path: "customers", method: "GET" },
    addresses: {
      fetch_path: "addresses",
      fetch_method: "GET",
      fetch_response_key: "addresses",
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
  });

  // Resource Configured/Test Statuses
  const [endpointStatuses, setEndpointStatuses] = useState<{
    products: StatusType;
    orderHistory: StatusType;
    customerProfile: StatusType;
    addresses: StatusType;
    createOrder: StatusType;
  }>({
    products: "untested",
    orderHistory: "untested",
    customerProfile: "untested",
    addresses: "untested",
    createOrder: "untested",
  });

  // Scoped Resource Modal Fields State (for modal inputs)
  const [prodPath, setProdPath] = useState("products");
  const [prodPayloadKey, setProdPayloadKey] = useState("query");
  const [prodResponseKey, setProdResponseKey] = useState("products");
  const [prodTestTerm, setProdTestTerm] = useState("laptop");

  const [ohPath, setOhPath] = useState("orders/history");
  const [ohResponseKey, setOhResponseKey] = useState("orders");

  const [cpPath, setCpPath] = useState("customers");

  const [addrActiveTab, setAddrActiveTab] = useState<"fetch" | "create">("fetch");
  const [addrFetchPath, setAddrFetchPath] = useState("addresses");
  const [addrFetchResponseKey, setAddrFetchResponseKey] = useState("addresses");
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
  const [coTestItemId, setCoTestItemId] = useState("item_999");
  const [coTestPrice, setCoTestPrice] = useState("299");
  const [coTestQuantity, setCoTestQuantity] = useState("1");

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

  // 1. LOCALSTORAGE PERSISTENCE (Step 1 Draft)
  useEffect(() => {
    if (pageLoading || isSavedToDb) return;
    const draft = {
      baseUrl,
      authEnabled,
      authDisabledAck,
      authUrl,
      authMethod,
      modalIdentifierField,
      modalIdentifierType,
      modalPasswordField,
      tokenPath,
      deliveryType,
      headerName,
      addBearer,
      cookieName,
      authConfig,
    };
    localStorage.setItem("onboarding_step1_draft", JSON.stringify(draft));
  }, [
    baseUrl,
    authEnabled,
    authDisabledAck,
    authUrl,
    authMethod,
    modalIdentifierField,
    modalIdentifierType,
    modalPasswordField,
    tokenPath,
    deliveryType,
    headerName,
    addBearer,
    cookieName,
    authConfig,
    pageLoading,
    isSavedToDb
  ]);

  // Load existing onboarding details on mount
  useEffect(() => {
    async function loadOnboarding() {
      try {
        const config = await fetchOnboardingDetails();
        if (config) {
          setIsSavedToDb(true);
          setOriginalConfig(config);
          setIsEditing(false);
          setBaseUrl(config.base_url);
          setAuthEnabled(config.auth_enabled);
          setAuthDisabledAck(config.auth_disabled_ack);

          if (config.branding_config) {
            setColorTheme(config.branding_config.brand_color || "");
            setLogoUrl(config.branding_config.logo_url || "");
          } else {
            setColorTheme("");
            setLogoUrl("");
          }
          setWebhookUrl(config.webhook_url || "");

          if (config.auth_config) {
            setAuthUrl(config.auth_config.auth_url || "https://api.acmestore.com/v1/auth/login");
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
              auth_url: config.auth_config.auth_url,
              method: config.auth_config.method,
              identifier_field: config.auth_config.identifier_field,
              identifier_type: config.auth_config.identifier_type,
              password_field: config.auth_config.password_field,
              token_path: config.auth_config.token_path,
              token_delivery: delivery
            });
          }
          // Load individual configurations from backend columns
          if (config.products_config) {
            setProdPath(config.products_config.path || "products");
            setProdPayloadKey(config.products_config.payload_key || "query");
            setProdResponseKey(config.products_config.response_key || "products");
          } else if (config.endpoints?.products) {
            setProdPath(config.endpoints.products.path || "products");
            setProdPayloadKey(config.endpoints.products.payload_key || "query");
            setProdResponseKey(config.endpoints.products.response_key || "products");
          }

          if (config.order_history_config) {
            setOhPath(config.order_history_config.path || "orders/history");
            setOhResponseKey(config.order_history_config.response_key || "orders");
          } else if (config.endpoints?.orderHistory) {
            setOhPath(config.endpoints.orderHistory.path || "orders/history");
            setOhResponseKey(config.endpoints.orderHistory.response_key || "orders");
          }

          if (config.customer_profile_config) {
            setCpPath(config.customer_profile_config.path || "customers");
          } else if (config.endpoints?.customerProfile) {
            setCpPath(config.endpoints.customerProfile.path || "customers");
          }

          if (config.addresses_config) {
            if (config.addresses_config.fetch) {
              setAddrFetchPath(config.addresses_config.fetch.path || "addresses");
              setAddrFetchResponseKey(config.addresses_config.fetch.response_key || "addresses");
            }
            if (config.addresses_config.create) {
              setAddrCreatePath(config.addresses_config.create.path || "addresses");
              setAddrCreateFields(config.addresses_config.create.field_mapping ? config.addresses_config.create.field_mapping.join(", ") : "line1, line2, city, state, pincode");
            }
          } else if (config.endpoints?.addresses) {
            setAddrFetchPath(config.endpoints.addresses.fetch_path || "addresses");
            setAddrFetchResponseKey(config.endpoints.addresses.fetch_response_key || "addresses");
            setAddrCreatePath(config.endpoints.addresses.create_path || "addresses");
            setAddrCreateFields(config.endpoints.addresses.create_fields || "line1, line2, city, state, pincode");
          }

          if (config.create_order_config) {
            setCoPath(config.create_order_config.path || "orders");
            setCoCartKey(config.create_order_config.cart_key || "cart");
            setCoItemIdField(config.create_order_config.item_id_field || "item_id");
            setCoPriceField(config.create_order_config.price_field || "price");
            setCoQuantityField(config.create_order_config.quantity_field || "quantity");
          } else if (config.endpoints?.createOrder) {
            setCoPath(config.endpoints.createOrder.path || "orders");
            setCoCartKey(config.endpoints.createOrder.cart_key || "cart");
            setCoItemIdField(config.endpoints.createOrder.item_id_field || "item_id");
            setCoPriceField(config.endpoints.createOrder.price_field || "price");
            setCoQuantityField(config.endpoints.createOrder.quantity_field || "quantity");
          }
          if (config.bank_account) setBankAccount(config.bank_account);
          if (config.ifsc) {
            setIfsc(config.ifsc);
            // Trigger IFSC Lookup immediately to auto-resolve bank details
            handleIfscLookup(config.ifsc);
          }

          setEndpointStatuses({
            products: "success",
            orderHistory: "success",
            customerProfile: "success",
            addresses: "success",
            createOrder: "success",
          });
        } else {
          setIsEditing(true); // Default to editing if DB is empty
          // Restore draft from localStorage if DB is empty
          const draftStr = localStorage.getItem("onboarding_step1_draft");
          if (draftStr) {
            try {
              const draft = JSON.parse(draftStr);
              setBaseUrl(draft.baseUrl);
              setAuthEnabled(draft.authEnabled);
              setAuthDisabledAck(draft.authDisabledAck);
              setAuthUrl(draft.authUrl);
              setAuthMethod(draft.authMethod);
              setModalIdentifierField(draft.modalIdentifierField);
              setModalIdentifierType(draft.modalIdentifierType);
              setModalPasswordField(draft.modalPasswordField);
              setTokenPath(draft.tokenPath);
              setDeliveryType(draft.deliveryType);
              setHeaderName(draft.headerName);
              setAddBearer(draft.addBearer);
              setCookieName(draft.cookieName);
              setAuthConfig(draft.authConfig);
              toast.info("Restored connection settings draft from browser storage.");
            } catch (e) {
              console.error("Failed to parse onboarding draft", e);
            }
          }
        }
      } catch (err) {
        if (axios.isCancel(err)) {
          return;
        }
        console.error("Failed to load onboarding info: ", err);
      } finally {
        setPageLoading(false);
      }
    }

    // Try reading cached test token
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

  const handleCancelEdit = () => {
    if (originalConfig) {
      setBaseUrl(originalConfig.base_url || "");
      setAuthEnabled(originalConfig.auth_enabled || false);
      setAuthDisabledAck(originalConfig.auth_disabled_ack || false);
      setBankAccount(originalConfig.bank_account || "");
      setIfsc(originalConfig.ifsc || "");

      if (originalConfig.branding_config) {
        setColorTheme(originalConfig.branding_config.brand_color || "");
        setLogoUrl(originalConfig.branding_config.logo_url || "");
      } else {
        setColorTheme("");
        setLogoUrl("");
      }
      setWebhookUrl(originalConfig.webhook_url || "");

      const oAuth = originalConfig.auth_config || {};
      setAuthUrl(oAuth.auth_url || "https://api.acmestore.com/v1/auth/login");
      setAuthMethod(oAuth.method || "POST");
      setModalIdentifierField(oAuth.identifier_field || "email");
      setModalIdentifierType(oAuth.identifier_type || "Email");
      setModalPasswordField(oAuth.password_field || "password");
      setTokenPath(oAuth.token_path || "token");

      const delivery = oAuth.token_delivery || {
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
        auth_url: oAuth.auth_url,
        method: oAuth.method,
        identifier_field: oAuth.identifier_field,
        identifier_type: oAuth.identifier_type,
        password_field: oAuth.password_field,
        token_path: oAuth.token_path,
        token_delivery: delivery
      });

      const oEndpoints = originalConfig.endpoints || {};
      const oProd = oEndpoints.products || originalConfig.products_config || {};
      setProdPath(oProd.path || "products");
      setProdPayloadKey(oProd.payload_key || "query");
      setProdResponseKey(oProd.response_key || "products");

      const oOh = oEndpoints.orderHistory || originalConfig.order_history_config || {};
      setOhPath(oOh.path || "orders/history");
      setOhResponseKey(oOh.response_key || "orders");

      const oCp = oEndpoints.customerProfile || originalConfig.customer_profile_config || {};
      setCpPath(oCp.path || "customers");

      const oAddr = oEndpoints.addresses || originalConfig.addresses_config || {};
      if (oAddr.fetch) {
        setAddrFetchPath(oAddr.fetch.path || "addresses");
        setAddrFetchResponseKey(oAddr.fetch.response_key || "addresses");
      } else {
        setAddrFetchPath(oAddr.fetch_path || "addresses");
        setAddrFetchResponseKey(oAddr.fetch_response_key || "addresses");
      }
      if (oAddr.create) {
        setAddrCreatePath(oAddr.create.path || "addresses");
        setAddrCreateFields(oAddr.create.field_mapping ? oAddr.create.field_mapping.join(", ") : "line1, line2, city, state, pincode");
      } else {
        setAddrCreatePath(oAddr.create_path || "addresses");
        setAddrCreateFields(oAddr.create_fields || "line1, line2, city, state, pincode");
      }

      const oCo = oEndpoints.createOrder || originalConfig.create_order_config || {};
      setCoPath(oCo.path || "orders");
      setCoCartKey(oCo.cart_key || "cart");
      setCoItemIdField(oCo.item_id_field || "item_id");
      setCoPriceField(oCo.price_field || "price");
      setCoQuantityField(oCo.quantity_field || "quantity");

      if (originalConfig.ifsc) {
        handleIfscLookup(originalConfig.ifsc);
      }
    }
    setIsEditing(false);
  };

  const hasPendingChanges = useMemo(() => {
    if (!originalConfig) {
      return baseUrl !== "" || bankAccount !== "" || ifsc !== "" || colorTheme !== "" || logoUrl !== "" || webhookUrl !== "";
    }

    if (baseUrl !== (originalConfig.base_url || "")) return true;
    if (authEnabled !== originalConfig.auth_enabled) return true;
    if (authDisabledAck !== originalConfig.auth_disabled_ack) return true;
    if (bankAccount !== (originalConfig.bank_account || "")) return true;
    if (ifsc !== (originalConfig.ifsc || "")) return true;
    if (webhookUrl !== (originalConfig.webhook_url || "")) return true;

    const oBrand = originalConfig.branding_config || {};
    if (colorTheme !== (oBrand.brand_color || "")) return true;
    if (logoUrl !== (oBrand.logo_url || "")) return true;

    const oAuth = originalConfig.auth_config || {};
    if (authUrl !== (oAuth.auth_url || "")) return true;
    if (authMethod !== (oAuth.method || "POST")) return true;
    if (modalIdentifierField !== (oAuth.identifier_field || "")) return true;
    if (modalIdentifierType !== (oAuth.identifier_type || "")) return true;
    if (modalPasswordField !== (oAuth.password_field || "")) return true;
    if (tokenPath !== (oAuth.token_path || "")) return true;

    const oDel = oAuth.token_delivery || {};
    if (deliveryType !== (oDel.method || "header")) return true;
    if (headerName !== (oDel.header_name || "Authorization")) return true;
    if (addBearer !== (oDel.bearer_prefix !== false)) return true;
    if (cookieName !== (oDel.cookie_name || "session")) return true;

    const oEndpoints = originalConfig.endpoints || {};
    const oProd = oEndpoints.products || originalConfig.products_config || {};
    if (prodPath !== (oProd.path || "products")) return true;
    if (prodPayloadKey !== (oProd.payload_key || "query")) return true;
    if (prodResponseKey !== (oProd.response_key || "products")) return true;

    const oOh = oEndpoints.orderHistory || originalConfig.order_history_config || {};
    if (ohPath !== (oOh.path || "orders/history")) return true;
    if (ohResponseKey !== (oOh.response_key || "orders")) return true;

    const oCp = oEndpoints.customerProfile || originalConfig.customer_profile_config || {};
    if (cpPath !== (oCp.path || "customers")) return true;

    const oAddr = oEndpoints.addresses || originalConfig.addresses_config || {};
    if (oAddr.fetch) {
      if (addrFetchPath !== (oAddr.fetch.path || "addresses")) return true;
      if (addrFetchResponseKey !== (oAddr.fetch.response_key || "addresses")) return true;
    } else {
      if (addrFetchPath !== (oAddr.fetch_path || "addresses")) return true;
      if (addrFetchResponseKey !== (oAddr.fetch_response_key || "addresses")) return true;
    }
    if (oAddr.create) {
      if (addrCreatePath !== (oAddr.create.path || "addresses")) return true;
      const originalFields = oAddr.create.field_mapping ? oAddr.create.field_mapping.join(", ") : "line1, line2, city, state, pincode";
      if (addrCreateFields !== originalFields) return true;
    } else {
      if (addrCreatePath !== (oAddr.create_path || "addresses")) return true;
      if (addrCreateFields !== (oAddr.create_fields || "line1, line2, city, state, pincode")) return true;
    }

    const oCo = oEndpoints.createOrder || originalConfig.create_order_config || {};
    if (coPath !== (oCo.path || "orders")) return true;
    if (coCartKey !== (oCo.cart_key || "cart")) return true;
    if (coItemIdField !== (oCo.item_id_field || "item_id")) return true;
    if (coPriceField !== (oCo.price_field || "price")) return true;
    if (coQuantityField !== (oCo.quantity_field || "quantity")) return true;

    return false;
  }, [
    originalConfig,
    baseUrl,
    authEnabled,
    authDisabledAck,
    bankAccount,
    ifsc,
    colorTheme,
    logoUrl,
    webhookUrl,
    authUrl,
    authMethod,
    modalIdentifierField,
    modalIdentifierType,
    modalPasswordField,
    tokenPath,
    deliveryType,
    headerName,
    addBearer,
    cookieName,
    prodPath,
    prodPayloadKey,
    prodResponseKey,
    ohPath,
    ohResponseKey,
    cpPath,
    addrFetchPath,
    addrFetchResponseKey,
    addrCreatePath,
    addrCreateFields,
    coPath,
    coCartKey,
    coItemIdField,
    coPriceField,
    coQuantityField,
  ]);

  const isFinishButtonVisible = !isSavedToDb || (isEditing && hasPendingChanges);

  // Update test token status resolving on object
  const getNestedValue = (obj: any, path: string): any => {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((acc, part) => acc && acc[part], obj);
  };

  // Recursively search object for auth keys
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

  // Validate entered path resolves in the last test response
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
      setAuthDisabledAck(false); // Reset to false whenever auth_enabled is true
    }
  };

  const confirmDisableAuth = () => {
    setAuthEnabled(false);
    setAuthDisabledAck(true);
    setShowConfirmDisableModal(false);
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
    } catch (err) {
      setIfscError("Failed to detect branch. Please check the IFSC code.");
      setResolvedBank("");
      setResolvedBranch("");
      setBankVerified(false);
    } finally {
      setBankLoading(false);
    }
  };

  // Trigger test customer auth request
  const handleTestCustomerAuth = async () => {
    setTestLoading(true);
    setTestResponseData(null);
    try {
      const reqPayload = {
        [modalIdentifierField]: testIdentifierValue,
        [modalPasswordField]: testPasswordValue
      };

      const result = await testCustomerAuth({
        auth_url: authUrl,
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
      toast.error("Failed to connect to authentication URL.");
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

    setAuthConfig({
      isConfigured: true,
      auth_url: authUrl,
      method: authMethod,
      identifier_field: modalIdentifierField,
      identifier_type: modalIdentifierType,
      password_field: modalPasswordField,
      token_path: tokenPath,
      token_delivery: deliveryConfig
    });

    // Capture the session token from Step 2 test result
    if (testResponseData) {
      const token = getNestedValue(testResponseData, tokenPath);
      if (token) {
        setSessionToken(token);
        sessionStorage.setItem("test_session_token", token);
      }
    }

    setShowMappingModal(false);
    toast.success("Customer login configurations saved successfully!");
  };

  const handleMockLogoUpload = () => {
    if (!isEditing) return;
    toast.success("Logo uploaded successfully (mock file: logo.png)");
    setLogoUrl("https://yourstore.com/logo.png");
  };

  // STEP GATING: Save Step 1 Connection details to Backend to unlock Step 2
  const handleSaveStep1 = async () => {
    setSaveLoading(true);
    try {
      const finalAuthConfig = authEnabled ? {
        auth_url: authUrl,
        method: authMethod,
        identifier_field: modalIdentifierField,
        identifier_type: modalIdentifierType,
        password_field: modalPasswordField,
        token_path: tokenPath,
        token_delivery: {
          method: deliveryType,
          header_name: deliveryType === "header" ? headerName : null,
          bearer_prefix: deliveryType === "header" ? addBearer : null,
          cookie_name: deliveryType === "cookie" ? cookieName : null,
        }
      } : null;

      const products_config = {
        path: prodPath,
        method: "GET",
        payload_key: prodPayloadKey,
        response_key: prodResponseKey
      };

      const order_history_config = {
        path: ohPath,
        method: "GET",
        response_key: ohResponseKey
      };

      const customer_profile_config = {
        path: cpPath,
        method: "GET"
      };

      const addresses_config = {
        fetch: {
          path: addrFetchPath,
          method: "GET",
          response_key: addrFetchResponseKey
        },
        create: {
          path: addrCreatePath,
          method: "POST",
          field_mapping: addrCreateFields.split(",").map(k => k.trim()).filter(Boolean)
        }
      };

      const create_order_config = {
        path: coPath,
        method: "POST",
        cart_key: coCartKey,
        item_id_field: coItemIdField,
        price_field: coPriceField,
        quantity_field: coQuantityField
      };

      const savedResponse = await saveOnboardingDetails({
        base_url: baseUrl,
        auth_enabled: authEnabled,
        auth_disabled_ack: authDisabledAck,
        auth_config: finalAuthConfig,
        products_config,
        order_history_config,
        customer_profile_config,
        addresses_config,
        create_order_config,
        bank_account: bankAccount,
        ifsc,
        branch_name: resolvedBranch || resolvedBank,
        branding_config: { brand_color: colorTheme, logo_url: logoUrl },
        webhook_url: webhookUrl,
      });

      setIsSavedToDb(true);
      setOriginalConfig(savedResponse);
      setIsEditing(false);
      localStorage.removeItem("onboarding_step1_draft");
      toast.success("Step 1 (Connection Details) saved successfully! Step 2 is now unlocked.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save connection details. Please verify your settings.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Open scoped resource config modal
  const handleOpenResourceModal = (resourceKey: string) => {
    setActiveResource(resourceKey);
    setModalTestResponse(null);
    setModalTestStatus("untested");
    setModalTestLoading(false);

    // Set dynamic tab for addresses
    if (resourceKey === "addresses") {
      setAddrActiveTab("fetch");
    }
  };

  // Scoped Resource Endpoint Save & Test flow
  const handleSaveAndTestResource = async (resourceKey: string) => {
    setModalTestLoading(true);
    setModalTestResponse(null);

    let path = "";
    let method = "GET";
    let reqPayload: Record<string, any> = {};

    // Gather scoped inputs based on active resource
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
        "address": "123 Mock Lane, Springfield"
      };
    }

    try {
      // 3. TOKEN REUSE IN STEP 2 TESTING
      const result = await testEndpoint({
        base_url: baseUrl,
        auth_needed: authEnabled,
        credential_value: authEnabled ? sessionToken : null,
        token_delivery_method: authEnabled ? authConfig.token_delivery?.method : null,
        token_delivery_name: authEnabled ? (
          authConfig.token_delivery?.method === "header"
            ? authConfig.token_delivery.header_name
            : authConfig.token_delivery.cookie_name
        ) : null,
        token_delivery_bearer: authEnabled ? authConfig.token_delivery?.bearer_prefix : null,
        path,
        method,
        payload: reqPayload
      });

      setModalTestResponse(result.data);
      const isSuccess = result.status === "success";
      setModalTestStatus(isSuccess ? "success" : "error");

      if (isSuccess) {
        toast.success(`${resourceKey.toUpperCase()} endpoint test passed!`);
      } else {
        toast.error(`${resourceKey.toUpperCase()} endpoint test failed.`);
      }

      // Save mapping to active endpoints state
      const updatedEndpoints = { ...endpoints };
      if (resourceKey === "products") {
        updatedEndpoints.products = { path, method, payload_key: prodPayloadKey, response_key: prodResponseKey };
      } else if (resourceKey === "orderHistory") {
        updatedEndpoints.orderHistory = { path, method, response_key: ohResponseKey };
      } else if (resourceKey === "customerProfile") {
        updatedEndpoints.customerProfile = { path, method };
      } else if (resourceKey === "addresses") {
        updatedEndpoints.addresses = {
          ...updatedEndpoints.addresses,
          fetch_path: addrFetchPath,
          fetch_method: "GET",
          fetch_response_key: addrFetchResponseKey,
          create_path: addrCreatePath,
          create_method: "POST",
          create_fields: addrCreateFields
        };
      } else if (resourceKey === "createOrder") {
        updatedEndpoints.createOrder = {
          path,
          method,
          cart_key: coCartKey,
          item_id_field: coItemIdField,
          price_field: coPriceField,
          quantity_field: coQuantityField
        };
      }
      setEndpoints(updatedEndpoints);
      setEndpointStatuses(prev => ({ ...prev, [resourceKey]: isSuccess ? "success" : "error" }));

    } catch (err) {
      setModalTestStatus("error");
      toast.error("Network error: Failed to reach testing endpoint.");
    } finally {
      setModalTestLoading(false);
    }
  };

  // Save the full configuration of resources + bank account to backend DB
  const handleFinish = async () => {
    setSaveLoading(true);
    try {
      const finalAuthConfig = authEnabled ? {
        auth_url: authUrl,
        method: authMethod,
        identifier_field: modalIdentifierField,
        identifier_type: modalIdentifierType,
        password_field: modalPasswordField,
        token_path: tokenPath,
        token_delivery: {
          method: deliveryType,
          header_name: deliveryType === "header" ? headerName : null,
          bearer_prefix: deliveryType === "header" ? addBearer : null,
          cookie_name: deliveryType === "cookie" ? cookieName : null,
        }
      } : null;

      const products_config = {
        path: prodPath,
        method: "GET",
        payload_key: prodPayloadKey,
        response_key: prodResponseKey
      };

      const order_history_config = {
        path: ohPath,
        method: "GET",
        response_key: ohResponseKey
      };

      const customer_profile_config = {
        path: cpPath,
        method: "GET"
      };

      const addresses_config = {
        fetch: {
          path: addrFetchPath,
          method: "GET",
          response_key: addrFetchResponseKey
        },
        create: {
          path: addrCreatePath,
          method: "POST",
          field_mapping: addrCreateFields.split(",").map(k => k.trim()).filter(Boolean)
        }
      };

      const create_order_config = {
        path: coPath,
        method: "POST",
        cart_key: coCartKey,
        item_id_field: coItemIdField,
        price_field: coPriceField,
        quantity_field: coQuantityField
      };

      const savedResponse = await saveOnboardingDetails({
        base_url: baseUrl,
        auth_enabled: authEnabled,
        auth_disabled_ack: authDisabledAck,
        auth_config: finalAuthConfig,
        products_config,
        order_history_config,
        customer_profile_config,
        addresses_config,
        create_order_config,
        bank_account: bankAccount,
        ifsc,
        branch_name: resolvedBranch || resolvedBank || "Verified Branch",
        branding_config: { brand_color: colorTheme, logo_url: logoUrl },
        webhook_url: webhookUrl,
      });

      setOriginalConfig(savedResponse);
      setIsEditing(false);

      toast.success("Onboarding configurations saved successfully!");

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (err) {
      console.error("Failed to save onboarding configuration: ", err);
      toast.error("Failed to save onboarding configurations.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Onboarding Completion Criteria
  const allEndpointsSuccess =
    endpointStatuses.products === "success" &&
    endpointStatuses.orderHistory === "success" &&
    endpointStatuses.customerProfile === "success" &&
    endpointStatuses.addresses === "success" &&
    endpointStatuses.createOrder === "success";

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
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            Connect Your Business APIs
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Provide your endpoint coordinates, authentication settings, and payout account details to complete setup.
          </p>
        </div>
        {isSavedToDb && (
          <Button
            type="button"
            variant={isEditing ? "secondary" : "primary"}
            onClick={() => {
              if (isEditing) {
                handleCancelEdit();
              } else {
                setIsEditing(true);
              }
            }}
            className="font-semibold shrink-0"
          >
            {isEditing ? "Cancel" : "Edit Settings"}
          </Button>
        )}
      </div>

      {/* Part A: Shared Connection Details Card */}
      <Card
        title="1. Shared Connection Details"
        description="Configure the base URL and customer authentication settings. These credentials are used by the AI agent to secure and identify store shoppers."
      >
        <div className="space-y-6">
          <Input
            label="API Base URL"
            placeholder="https://api.yourstore.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
            disabled={saveLoading || !isEditing}
          />

          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
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
                  Securely validates customers via tokens before letting them query order histories or profiles.
                </p>
              </div>
            </div>
            <Switch
              checked={authEnabled}
              onCheckedChange={handleToggleAuth}
              disabled={saveLoading || !isEditing}
            />
          </div>

          {/* Conditional Customer Auth Fields */}
          {authEnabled && (
            <div className="border border-border bg-background-alt p-5 rounded-xl space-y-6 animate-fade-in">
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
                    label="Customer Login URL"
                    placeholder="https://api.yourstore.com/v1/auth/login"
                    value={authUrl}
                    onChange={(e) => setAuthUrl(e.target.value)}
                    required
                    disabled={saveLoading || !isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    HTTP Method
                  </label>
                  <select
                    value={authMethod}
                    onChange={(e) => setAuthMethod(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors cursor-pointer"
                    disabled={saveLoading || !isEditing}
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
              </div>

              {/* Configure Fields Button or Config Summary */}
              {authConfig.isConfigured ? (
                <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg text-sm">
                  <div className="space-y-1">
                    <p className="text-text-secondary">
                      Payload: <strong className="text-text-primary">"{authConfig.identifier_field}"</strong> ({authConfig.identifier_type}) &bull; Target: <strong className="text-text-primary">"{authConfig.token_path}"</strong>
                    </p>
                    <p className="text-text-secondary">
                      Delivery: <strong className="text-text-primary">{authConfig.token_delivery.method === "header" ? `Header (${authConfig.token_delivery.header_name})` : `Cookie (${authConfig.token_delivery.cookie_name})`}</strong>
                    </p>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setMappingStep(1);
                        setShowMappingModal(true);
                      }}
                      className="text-primary hover:underline font-semibold flex items-center gap-1 text-xs cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Configuration
                    </button>
                  )}
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
                    disabled={authUrl.trim() === "" || !isEditing}
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
          <div className="border border-border bg-background p-5 rounded-xl space-y-6">
            <span className="text-sm font-bold text-text-primary block border-b border-border pb-3">Widget Branding & Webhooks</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

              {/* Accent Color Picker & Text Input */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Accent Color Theme (Hex)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorTheme || "#4338CA"}
                    onChange={(e) => setColorTheme(e.target.value)}
                    disabled={saveLoading || !isEditing}
                    className="w-11 h-11 border border-border rounded-lg cursor-pointer bg-surface p-1"
                  />
                  <div className="flex-1">
                    <Input
                      value={(colorTheme || "").toUpperCase()}
                      onChange={(e) => setColorTheme(e.target.value)}
                      placeholder="#4338CA"
                      maxLength={7}
                      disabled={saveLoading || !isEditing}
                    />
                  </div>
                </div>
              </div>

              {/* Logo Mock Upload UI */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Widget Logo
                </label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <div className="relative w-16 h-16 rounded-xl border border-border bg-surface flex items-center justify-center overflow-hidden">
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => {
                        (e.target as any).style.display = 'none';
                      }} />
                      <div className="absolute inset-0 bg-secondary/55 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity">
                        <UploadCloud className="w-5 h-5 animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={handleMockLogoUpload}
                      className={`w-16 h-16 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center text-text-secondary hover:text-primary hover:border-primary transition-colors ${isEditing ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                      role="presentation"
                    >
                      <UploadCloud className="w-6 h-6" />
                      <span className="text-[10px] font-semibold mt-1">Upload</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {logoUrl ? "Custom Logo Active" : "Default Avatar Active"}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Supports PNG, JPG, or SVG. Suggested size 512x512px.
                    </p>
                    {logoUrl && isEditing && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl("")}
                        className="text-error hover:underline text-xs font-semibold mt-1 block"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
            <Input
              label="Merchant Webhook URL"
              placeholder="https://api.yourstore.com/webhooks/payments"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={saveLoading || !isEditing}
            />
          </div>

          {/* STEP 1 SAVE BUTTON */}
          {!isSavedToDb && (
            <div className="flex justify-end border-t border-border pt-4">
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveStep1}
                disabled={saveLoading || baseUrl.trim() === "" || (authEnabled && !authConfig.isConfigured)}
                className="flex items-center gap-2"
              >
                {saveLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Connection...</span>
                  </>
                ) : (
                  <>
                    <Server className="w-4 h-4" />
                    <span>Save Connection Details</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Part B: Endpoints Mapping Card (Step Gated) */}
      <Card
        title="2. Resource Endpoints"
        description="Verify connection details for individual endpoint resource paths. You must configure and test each endpoint below."
      >
        {!isSavedToDb ? (
          <div className="p-8 text-center bg-background border border-border border-dashed rounded-xl flex flex-col items-center justify-center gap-3">
            <Lock className="w-8 h-8 text-text-secondary animate-pulse" />
            <p className="text-sm font-semibold text-text-secondary">
              Step 2 is Locked
            </p>
            <p className="text-xs text-text-secondary">
              Complete and save Step 1 (Connection Details) above to unlock endpoint configurations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 animate-fade-in">
            {/* Products Card */}
            <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between h-48 shadow-xs hover:border-primary transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-text-primary">Products Catalog</span>
                  <StatusBadge status={endpointStatuses.products} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Allows the agent to search your product catalog keywords dynamically.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleOpenResourceModal("products")}
                className="w-full justify-center"
                disabled={!isEditing}
              >
                Configure & Test
              </Button>
            </div>

            {/* Order History Card */}
            <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between h-48 shadow-xs hover:border-primary transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-text-primary">Order History</span>
                  <StatusBadge status={endpointStatuses.orderHistory} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Retrieves active status and previous order history records for shoppers.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleOpenResourceModal("orderHistory")}
                className="w-full justify-center"
                disabled={!isEditing}
              >
                Configure & Test
              </Button>
            </div>

            {/* Customer Profile Card */}
            <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between h-48 shadow-xs hover:border-primary transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-text-primary">Customer Profile</span>
                  <StatusBadge status={endpointStatuses.customerProfile} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Fetches loyalty tier records and profile information.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleOpenResourceModal("customerProfile")}
                className="w-full justify-center"
                disabled={!isEditing}
              >
                Configure & Test
              </Button>
            </div>

            {/* Addresses Card */}
            <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between h-48 shadow-xs hover:border-primary transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-text-primary">Customer Addresses</span>
                  <StatusBadge status={endpointStatuses.addresses} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Fetch existing or register new shipment locations for customer checkouts.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleOpenResourceModal("addresses")}
                className="w-full justify-center"
                disabled={!isEditing}
              >
                Configure & Test
              </Button>
            </div>

            {/* Create Order Card */}
            <div className="border border-border bg-surface p-5 rounded-xl flex flex-col justify-between h-48 shadow-xs hover:border-primary transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-text-primary">Create Order</span>
                  <StatusBadge status={endpointStatuses.createOrder} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Submits cart contents and creates orders inside your billing pipeline.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleOpenResourceModal("createOrder")}
                className="w-full justify-center"
                disabled={!isEditing}
              >
                Configure & Test
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Part C: Settlement Bank Target */}
      <Card
        title="3. Settlement Bank Account"
        description="Provide your business deposit details to route payouts from Razorpay transaction completions."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Bank Account Number"
              type="text"
              placeholder="09280192839128"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
              required
              disabled={saveLoading || !isEditing}
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
                disabled={saveLoading || !isEditing}
              />
              {bankLoading && (
                <span className="absolute right-3 top-9 text-xs text-text-secondary animate-pulse">
                  Validating...
                </span>
              )}
            </div>
          </div>

          {bankVerified && resolvedBank && (
            <div className="p-4 border border-success/20 bg-success/5 rounded-lg flex items-center justify-between animate-fade-in">
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
                {isSetupComplete ? "All Integration Rules Met" : "Pending Setup Configuration"}
              </p>
              <p className="text-xs text-text-secondary">
                {isSetupComplete
                  ? "Your endpoints, credentials, and settlement bank have been verified successfully."
                  : "All endpoints, credentials mapping, and the bank settlement lookup must be verified to complete setup."}
              </p>
            </div>
          </div>

          {isFinishButtonVisible && (
            <Button
              type="button"
              variant="primary"
              onClick={handleFinish}
              disabled={!isSetupComplete || saveLoading}
              className="flex items-center gap-2 shadow-xs min-w-[140px] justify-center"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span>Finish Setup</span>
                </>
              )}
            </Button>
          )}
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
              Without authentication, the AI agent <b>cannot securely identify customers</b>, <b>cannot show order history</b> or order status per customer, and <b>cannot restrict access</b> to a customer's own data. Proceed only if this merchant's use case truly has no per-customer data or runs fully anonymously.
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

      {/* MAPPING STEP-MODAL: Map Login Fields */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-2xl w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
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

            {/* Stepper indicator bar */}
            <div className="px-6 py-3 border-b border-border bg-surface flex items-center justify-between shrink-0 text-xs font-semibold select-none">
              {[
                { step: 1, label: "Payload Mapping" },
                { step: 2, label: "Test API URL" },
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

            {/* Modal Scrollable Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans">
              {/* STEP 1: Payload mapping */}
              {mappingStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Configure Payload Parameters</h4>
                    <p className="text-xs text-text-secondary">
                      Specify the JSON field keys that your authentication API expects during login requests.
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

              {/* STEP 2: Test auth endpoint */}
              {mappingStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Send Test Credentials</h4>
                    <p className="text-xs text-text-secondary">
                      Provide temporary sandbox credentials to test the login route and receive a token response. (These values are not saved).
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

              {/* STEP 3: Token detection */}
              {mappingStep === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Extract Token Path</h4>
                    <p className="text-xs text-text-secondary">
                      Specify the path inside the JSON response where the authenticated session token resides.
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

                    {/* Status Indicator */}
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
                      {tokenPathStatus === "none" && (
                        <span className="inline-flex items-center gap-1 text-xs text-text-secondary bg-background border border-border px-2.5 py-1 rounded-full">
                          <HelpCircle className="w-3.5 h-3.5" /> Empty
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

              {/* STEP 4: Token delivery */}
              {mappingStep === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-text-primary">Token Delivery Method</h4>
                    <p className="text-xs text-text-secondary">
                      Choose how the customer authentication token should be attached to subsequent resource requests.
                    </p>
                  </div>

                  {/* Delivery Selection */}
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

                  {/* Conditional inputs */}
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

      {/* SCOPED RESOURCE MODAL: Scoped endpoint configs and testing */}
      {activeResource && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-2xl w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-background-alt shrink-0">
              <div>
                <h3 className="font-heading text-lg font-bold text-text-primary">
                  Configure {activeResource === "products" ? "Products API" :
                    activeResource === "orderHistory" ? "Order History API" :
                      activeResource === "customerProfile" ? "Customer Profile API" :
                        activeResource === "addresses" ? "Addresses (Fetch/Create)" : "Create Order API"}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Configure specific resource properties and verify real API responses.
                </p>
              </div>
              <button
                onClick={() => setActiveResource(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans">

              {/* products resource layout */}
              {activeResource === "products" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="relative">
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-sm font-medium text-text-primary">Endpoint Path</label>
                      <div className="group relative">
                        <Info className="w-4 h-4 text-text-secondary cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                          The endpoint path appended to Base URL to search products.
                        </span>
                      </div>
                    </div>
                    <Input
                      placeholder="products"
                      value={prodPath}
                      onChange={(e) => setProdPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="block text-sm font-medium text-text-primary">Search Query Param Key</label>
                        <div className="group relative">
                          <Info className="w-4 h-4 text-text-secondary cursor-help" />
                          <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                            The parameter key used to pass keywords (e.g. query).
                          </span>
                        </div>
                      </div>
                      <Input
                        placeholder="query"
                        value={prodPayloadKey}
                        onChange={(e) => setProdPayloadKey(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="block text-sm font-medium text-text-primary">Results Array Path</label>
                        <div className="group relative">
                          <Info className="w-4 h-4 text-text-secondary cursor-help" />
                          <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                            Dot-notation path resolving to the products list in response.
                          </span>
                        </div>
                      </div>
                      <Input
                        placeholder="products"
                        value={prodResponseKey}
                        onChange={(e) => setProdResponseKey(e.target.value)}
                        required
                      />
                    </div>
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

              {/* order history resource layout */}
              {activeResource === "orderHistory" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-sm font-medium text-text-primary">Endpoint Path</label>
                      <div className="group relative">
                        <Info className="w-4 h-4 text-text-secondary cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                          The endpoint path to fetch shipping/orders list.
                        </span>
                      </div>
                    </div>
                    <Input
                      placeholder="orders/history"
                      value={ohPath}
                      onChange={(e) => setOhPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="block text-sm font-medium text-text-primary">Orders List Array Path</label>
                      <div className="group relative">
                        <Info className="w-4 h-4 text-text-secondary cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                          Dot-notation path mapping the array response (empty if array directly).
                        </span>
                      </div>
                    </div>
                    <Input
                      placeholder="orders"
                      value={ohResponseKey}
                      onChange={(e) => setOhResponseKey(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* customer profile resource layout */}
              {activeResource === "customerProfile" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-sm font-medium text-text-primary">Endpoint Path</label>
                      <div className="group relative">
                        <Info className="w-4 h-4 text-text-secondary cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                          The endpoint path returning client profile details.
                        </span>
                      </div>
                    </div>
                    <Input
                      placeholder="customers"
                      value={cpPath}
                      onChange={(e) => setCpPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />
                  </div>
                </div>
              )}

              {/* customer addresses resource layout */}
              {activeResource === "addresses" && (
                <div className="space-y-6 animate-fade-in">
                  {/* Tabs Selector fetch/create */}
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
                      Fetch Operation (GET)
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
                      Create Operation (POST)
                    </button>
                  </div>

                  {addrActiveTab === "fetch" ? (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="block text-sm font-medium text-text-primary">Fetch Path</label>
                          <div className="group relative">
                            <Info className="w-4 h-4 text-text-secondary cursor-help" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                              The endpoint used to fetch customer addresses.
                            </span>
                          </div>
                        </div>
                        <Input
                          placeholder="addresses"
                          value={addrFetchPath}
                          onChange={(e) => setAddrFetchPath(e.target.value.replace(/^\/+/, ""))}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1.5">Addresses Array Path</label>
                        <Input
                          placeholder="addresses"
                          value={addrFetchResponseKey}
                          onChange={(e) => setAddrFetchResponseKey(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="block text-sm font-medium text-text-primary">Create Path</label>
                          <div className="group relative">
                            <Info className="w-4 h-4 text-text-secondary cursor-help" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                              The endpoint used to submit customer address.
                            </span>
                          </div>
                        </div>
                        <Input
                          placeholder="addresses"
                          value={addrCreatePath}
                          onChange={(e) => setAddrCreatePath(e.target.value.replace(/^\/+/, ""))}
                          required
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="block text-sm font-medium text-text-primary">Required JSON Keys (Comma separated)</label>
                          <div className="group relative">
                            <Info className="w-4 h-4 text-text-secondary cursor-help" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                              The key names your API expects (e.g. line1, city, pincode).
                            </span>
                          </div>
                        </div>
                        <Input
                          placeholder="line1, line2, city, state, pincode"
                          value={addrCreateFields}
                          onChange={(e) => {
                            setAddrCreateFields(e.target.value);
                            // Auto-populate dynamic test inputs based on split keys
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

                      {/* Dynamic Test Inputs Scoped Fields */}
                      <div className="border-t border-border pt-4 space-y-4">
                        <span className="text-xs font-bold text-text-secondary uppercase">Test Address Values</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {addrCreateFields.split(",").map(k => k.trim()).filter(Boolean).map(keyName => (
                            <div key={keyName}>
                              <label className="block text-xs font-medium text-text-secondary mb-1">{keyName}</label>
                              <input
                                type="text"
                                className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-sans"
                                value={addrCreateTestInputs[keyName] || ""}
                                onChange={(e) => {
                                  setAddrCreateTestInputs(prev => ({
                                    ...prev,
                                    [keyName]: e.target.value
                                  }));
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* create order resource layout */}
              {activeResource === "createOrder" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-sm font-medium text-text-primary">Endpoint Path</label>
                      <div className="group relative">
                        <Info className="w-4 h-4 text-text-secondary cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                          The endpoint path to submit cart orders.
                        </span>
                      </div>
                    </div>
                    <Input
                      placeholder="orders"
                      value={coPath}
                      onChange={(e) => setCoPath(e.target.value.replace(/^\/+/, ""))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="block text-sm font-medium text-text-primary">Cart Wrapper Key</label>
                        <div className="group relative">
                          <Info className="w-4 h-4 text-text-secondary cursor-help" />
                          <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                            The JSON array wrapper key name (e.g. cart).
                          </span>
                        </div>
                      </div>
                      <Input
                        placeholder="cart"
                        value={coCartKey}
                        onChange={(e) => setCoCartKey(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="block text-sm font-medium text-text-primary">Item ID key name</label>
                        <div className="group relative">
                          <Info className="w-4 h-4 text-text-secondary cursor-help" />
                          <span className="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 bg-secondary text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center mb-1.5 z-10 font-sans shadow-lg">
                            The JSON key representing target item ID.
                          </span>
                        </div>
                      </div>
                      <Input
                        placeholder="item_id"
                        value={coItemIdField}
                        onChange={(e) => setCoItemIdField(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">Price key name</label>
                      <Input
                        placeholder="price"
                        value={coPriceField}
                        onChange={(e) => setCoPriceField(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">Quantity key name</label>
                      <Input
                        placeholder="quantity"
                        value={coQuantityField}
                        onChange={(e) => setCoQuantityField(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Mock Item inputs */}
                  <div className="border-t border-border pt-4 space-y-4">
                    <span className="text-xs font-bold text-text-secondary uppercase">Test Cart Item Values</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Input
                        label="Sample Item ID"
                        value={coTestItemId}
                        onChange={(e) => setCoTestItemId(e.target.value)}
                      />
                      <Input
                        label="Sample Price ($)"
                        value={coTestPrice}
                        onChange={(e) => setCoTestPrice(e.target.value.replace(/\D/g, ""))}
                      />
                      <Input
                        label="Sample Quantity"
                        value={coTestQuantity}
                        onChange={(e) => setCoTestQuantity(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. TOKEN REUSE WARNING INFO BOX */}
              {authEnabled && !sessionToken && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning flex items-start gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No Authentication Token Found</p>
                    <p className="mt-0.5">Please test customer login first to generate a token, or proceed to test without tokens attached.</p>
                  </div>
                </div>
              )}

              {/* JSON RESPONSE BODY INLINE VIEWER */}
              {modalTestResponse && (
                <div className="space-y-2 border-t border-border pt-6 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-text-secondary uppercase">
                      Raw Response JSON
                    </label>
                    <div className="flex items-center gap-1.5">
                      {modalTestStatus === "success" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 px-2 py-0.5 rounded border border-success/20 font-semibold font-sans">
                          <Check className="w-3 h-3" /> 200 Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-error bg-error/10 px-2 py-0.5 rounded border border-error/20 font-semibold font-sans">
                          <X className="w-3 h-3" /> Error Code
                        </span>
                      )}
                    </div>
                  </div>
                  <pre className="p-4 bg-background border border-border rounded-xl text-xs font-mono text-text-primary max-h-48 overflow-auto select-all">
                    {JSON.stringify(modalTestResponse, null, 2)}
                  </pre>
                </div>
              )}

            </div>

            {/* Modal Footer (Save & Test Trigger) */}
            <div className="p-5 border-t border-border flex items-center justify-between bg-background-alt shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveResource(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => handleSaveAndTestResource(activeResource)}
                disabled={modalTestLoading}
                className="flex items-center gap-2"
              >
                {modalTestLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 shrink-0" />
                    <span>Save & Test</span>
                  </>
                )}
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
