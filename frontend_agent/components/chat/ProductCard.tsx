"use client";

import React, { useState } from "react";
import { Product } from "@/lib/mock/chat";
import { ShoppingCart } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export function getCurrencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "INR":
      return "₹";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return currency + " ";
  }
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [imgError, setImgError] = useState(!product.thumbnailUrl);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
    } else {
      console.log("Added product to cart:", product);
    }
  };

  const firstLetter = product.name ? product.name.charAt(0).toUpperCase() : "?";

  return (
    <div className="group flex flex-col w-56 h-76 shrink-0 rounded-xl bg-white border border-secondary-200 overflow-hidden shadow-xs transition-all duration-300 hover:shadow-md hover:border-secondary-300 select-none">
      {/* Thumbnail Container */}
      <div className="relative w-full h-32 bg-secondary-100 flex items-center justify-center shrink-0 overflow-hidden">
        {imgError ? (
          <div className="flex items-center justify-center w-full h-full bg-secondary-50 text-secondary-400 font-semibold text-3xl font-sans">
            {firstLetter}
          </div>
        ) : (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>

      {/* Product Information */}
      <div className="flex flex-col flex-1 p-3.5 justify-between">
        <div>
          <h4 
            title={product.name}
            className="text-sm font-bold text-secondary-900 line-clamp-1 group-hover:text-primary-600 transition-colors"
          >
            {product.name}
          </h4>
          <p 
            title={product.description}
            className="text-xs text-secondary-500 mt-1 line-clamp-2 leading-relaxed"
          >
            {product.description}
          </p>
        </div>

        {/* Pricing and Action */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-secondary-100">
          <span className="text-sm font-bold text-secondary-900 font-mono">
            {getCurrencySymbol(product.currency)}
            {product.price}
          </span>
          <button
            onClick={handleAddToCart}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary-900 text-white font-sans text-[11px] font-semibold transition-all hover:bg-secondary-800 active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
