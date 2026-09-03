import React from "react";
import { Metadata } from "next";
import EndpointsClient from "./EndpointsClient";

export const metadata: Metadata = {
  title: "Essential Endpoints for Agentic E-Commerce | ShopAgent Docs",
  description: "Complete API specification for Agentic E-Commerce: product search, address management, checkout order creation, API key management, payment signature verification, and S2S order verification.",
};

export default function EndpointsPage() {
  return <EndpointsClient />;
}
