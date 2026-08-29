"use client";

import React from "react";
import { Product } from "@/lib/mock/chat";
import ProductCard from "./ProductCard";

interface ProductCardGridProps {
  products: Product[];
  onAddToCart?: (product: Product) => void;
}

export default function ProductCardGrid({ products, onAddToCart }: ProductCardGridProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className="w-full mt-4">
      {/* Scrollable Container */}
      <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-x-visible md:pb-0">
        {products.map((product) => (
          <div key={product.id} className="snap-start">
            <ProductCard product={product} onAddToCart={onAddToCart} />
          </div>
        ))}
      </div>
    </div>
  );
}
