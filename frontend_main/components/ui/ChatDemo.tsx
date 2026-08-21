"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  sender: "customer" | "agent";
  content: React.ReactNode;
}

export const ChatDemo: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [keyCounter, setKeyCounter] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];

    const runSequence = () => {
      // Clear state and force key reset for exit/entrance animations
      setMessages([]);
      setIsTyping(false);
      setKeyCounter((prev) => prev + 1);

      // Step 1: Customer asks a question
      const t1 = setTimeout(() => {
        setMessages([
          {
            id: "msg-1",
            sender: "customer",
            content: "Do you have running shoes under ₹3000?",
          },
        ]);
        setIsTyping(true);
      }, 500);
      timeouts.push(t1);

      // Step 2: Agent replies with 2 product cards
      const t2 = setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: "msg-2",
            sender: "agent",
            content: (
              <div className="space-y-3">
                <p>Yes, here are two options currently in stock:</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Product Card A */}
                  <div className="border border-border rounded-lg bg-surface p-2.5 transition-all duration-300">
                    <div className="aspect-square bg-primary-light rounded-md flex items-center justify-center mb-2 overflow-hidden relative">
                      <img
                        src="/assets/shoes_1.png"
                        alt="Velocity Runner"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs font-bold text-text-primary truncate">
                      Velocity Runner
                    </div>
                    <div className="text-xs font-semibold text-text-secondary mt-0.5">
                      ₹2,499
                    </div>
                  </div>

                  {/* Product Card B */}
                  <div className="border border-border rounded-lg bg-surface p-2.5 transition-all duration-300 opacity-60">
                    <div className="aspect-square bg-primary-light rounded-md flex items-center justify-center mb-2 overflow-hidden relative">
                      <img
                        src="/assets/shoes_2.png"
                        alt="Trail Blazer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs font-bold text-text-primary truncate">
                      Trail Blazer
                    </div>
                    <div className="text-xs font-semibold text-text-secondary mt-0.5">
                      ₹2,899
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
        ]);
      }, 2800);
      timeouts.push(t2);

      // Step 3: Customer selects card A and confirms selection
      const t3 = setTimeout(() => {
        setMessages((prev) => {
          const updated = [...prev];
          // Highlight first card by editing second message
          updated[1] = {
            id: "msg-2",
            sender: "agent",
            content: (
              <div className="space-y-3">
                <p>Yes, here are two options currently in stock:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-2 border-primary rounded-lg bg-surface p-2.5 transition-all duration-300 shadow-xs scale-102">
                    <div className="aspect-square bg-primary-light rounded-md flex items-center justify-center mb-2 overflow-hidden relative">
                      <img
                        src="/assets/shoes_1.png"
                        alt="Velocity Runner"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs font-bold text-text-primary truncate">
                      Velocity Runner
                    </div>
                    <div className="text-xs font-semibold text-text-secondary mt-0.5">
                      ₹2,499
                    </div>
                  </div>
                  <div className="border border-border rounded-lg bg-surface p-2.5 transition-all duration-300 opacity-30">
                    <div className="aspect-square bg-primary-light rounded-md flex items-center justify-center mb-2 overflow-hidden relative">
                      <img
                        src="/assets/shoes_2.png"
                        alt="Trail Blazer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs font-bold text-text-primary truncate">
                      Trail Blazer
                    </div>
                    <div className="text-xs font-semibold text-text-secondary mt-0.5">
                      ₹2,899
                    </div>
                  </div>
                </div>
              </div>
            ),
          };
          return [
            ...updated,
            {
              id: "msg-3",
              sender: "customer",
              content: "I'll take the Velocity Runner.",
            },
          ];
        });
        setIsTyping(true);
      }, 5200);
      timeouts.push(t3);

      // Step 4: Agent requests confirmation
      const t4 = setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: "msg-4",
            sender: "agent",
            content: "Great choice! Confirm payment of ₹2,499?",
          },
        ]);
      }, 7500);
      timeouts.push(t4);

      // Step 5: Customer confirms
      const t5 = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: "msg-5",
            sender: "customer",
            content: "Yes",
          },
        ]);
        setIsTyping(true);
      }, 9500);
      timeouts.push(t5);

      // Step 6: Agent confirms successful order
      const t6 = setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: "msg-6",
            sender: "agent",
            content: (
              <div className="flex items-center gap-1.5 text-success font-semibold">
                <Check className="w-5 h-5 stroke-[3] shrink-0" />
                <span>Payment successful. Your order is confirmed.</span>
              </div>
            ),
          },
        ]);
      }, 11800);
      timeouts.push(t6);

      // Step 7: Reset sequence
      const t7 = setTimeout(() => {
        runSequence();
      }, 16000);
      timeouts.push(t7);
    };

    runSequence();

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div className="w-full max-w-sm mx-auto border border-border bg-surface rounded-2xl shadow-md overflow-hidden flex flex-col h-[480px]">
      {/* Header */}
      <div className="h-14 border-b border-border bg-surface px-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-heading font-bold text-text-on-primary text-xs shrink-0">
          A
        </div>
        <div>
          <div className="text-sm font-bold text-text-primary leading-tight select-text">
            Acme Assistant
          </div>
          <div className="text-[10px] text-success font-semibold flex items-center gap-1 select-text">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Feed container */}
      <div
        ref={containerRef}
        className="flex-1 p-4 space-y-4 overflow-y-auto bg-background/50 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={`${keyCounter}-${msg.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`flex ${
                msg.sender === "customer" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm select-text ${
                  msg.sender === "customer"
                    ? "bg-primary-light text-primary font-medium"
                    : "bg-surface border border-border text-text-primary shadow-xs"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Pulsing dots indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-1 shadow-xs">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{
                    y: ["0px", "-5px", "0px"],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.15,
                  }}
                  className="w-1.5 h-1.5 bg-text-secondary rounded-full inline-block"
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input panel */}
      <div className="p-3 border-t border-border bg-surface">
        <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-secondary leading-none select-none">
          Type a message...
        </div>
      </div>
    </div>
  );
};
