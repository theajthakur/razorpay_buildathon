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
    <div className="group flex flex-col w-[180px] h-[220px] shrink-0 rounded-xl bg-white border border-secondary-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-secondary-200 select-none">
      {/* Thumbnail Container */}
      <div className="relative w-full h-[96px] bg-secondary-50 flex items-center justify-center shrink-0 overflow-hidden">
        {imgError ? (
          <div className="flex items-center justify-center w-full h-full bg-secondary-50 text-secondary-300 font-bold text-xl font-sans">
            {firstLetter}
          </div>
        ) : (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
          />
        )}
      </div>

      {/* Product Information */}
      <div className="flex flex-col justify-between flex-grow p-2.5">
        <div className="flex flex-col gap-0.5">
          <h4 
            title={product.name}
            className="text-[12px] font-semibold text-secondary-900 line-clamp-1 group-hover:text-primary-600 transition-colors leading-tight"
          >
            {product.name}
          </h4>
          {product.description ? (
            <p 
              title={product.description}
              className="text-[10px] text-secondary-400 line-clamp-2 leading-normal"
            >
              {product.description}
            </p>
          ) : (
            <p className="text-[10px] text-secondary-300 italic line-clamp-1">
              Freshly prepared
            </p>
          )}
        </div>

        {/* Pricing and Action */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] font-bold text-secondary-900 font-mono">
            {getCurrencySymbol(product.currency)}
            {product.price}
          </span>
          <button
            onClick={handleAddToCart}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary-955 text-white font-sans text-[9px] font-semibold transition-all hover:bg-secondary-800 active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
