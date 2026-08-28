"use client";

import React, { useState } from "react";
import { Menu, X, Plus, MessageSquare, Calendar, ChevronRight } from "lucide-react";
import { Logo } from "../common/Logo";
import { LoginButton } from "../common/LoginButton";
import { ScrollArea } from "../common/ScrollArea";

interface AppShellProps {
  children: React.ReactNode;
}

const MOCK_CHATS = [
  { id: "1", title: "Spicy Ramen & Gyoza", date: "Today, 1:24 PM", active: true },
  { id: "2", title: "Double Cheese Pepperoni", date: "Yesterday, 8:45 PM" },
  { id: "3", title: "Superfood Avocado Salad", date: "2 days ago" },
  { id: "4", title: "Acai Berry Power Bowl", date: "3 days ago" },
  { id: "5", title: "Paneer Tikka Roll & Lassi", date: "Aug 24, 2026" },
  { id: "6", title: "Sushi Combo Deluxe", date: "Aug 22, 2026" },
];

export function AppShell({ children }: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState("1");

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setIsMobileSidebarOpen(false); // Close drawer on mobile
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-secondary-900 border-r border-secondary-200 dark:border-secondary-800/80">
      {/* Top Section: Logo */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-secondary-100 dark:border-secondary-800/50 shrink-0">
        <Logo />
        {/* Mobile close button inside the drawer */}
        <button
          onClick={toggleMobileSidebar}
          className="p-1 rounded-lg text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800 md:hidden focus:outline-none cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Middle Section: Scrollable Sessions & New Chat */}
      <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
        {/* New Chat Button */}
        <button
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold text-sm shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          onClick={() => alert("Creating a new chat session (coming soon!)")}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Chat</span>
        </button>

        {/* Scrollable list of chats */}
        <div className="flex-1 flex flex-col min-h-0 space-y-1.5">
          <div className="flex items-center justify-between px-2 text-[11px] font-bold tracking-wider text-secondary-400 dark:text-secondary-500 uppercase select-none">
            <span>Recent Chats</span>
            <span>{MOCK_CHATS.length}</span>
          </div>

          <ScrollArea className="flex-1 -mx-2 px-2 py-1 space-y-1">
            {MOCK_CHATS.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`flex flex-col items-start w-full p-3 rounded-xl transition-all duration-200 text-left cursor-pointer group focus:outline-none ${
                    isActive
                      ? "bg-surface-200 dark:bg-secondary-800 text-secondary-900 dark:text-background-50 font-medium"
                      : "hover:bg-background-100 dark:hover:bg-secondary-800/40 text-secondary-600 dark:text-secondary-400"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-primary-500"
                            : "text-secondary-400 group-hover:text-secondary-500 dark:group-hover:text-secondary-300"
                        }`}
                      />
                      <span className="text-xs font-semibold truncate w-full">
                        {chat.title}
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 ${
                        isActive ? "text-primary-500" : "text-secondary-400"
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-secondary-400 dark:text-secondary-500 font-medium">
                    <Calendar className="w-3 h-3" />
                    <span>{chat.date}</span>
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </div>
      </div>

      {/* Bottom Section: Profile/Auth */}
      <div className="p-4 border-t border-secondary-100 dark:border-secondary-800/50 shrink-0 bg-background-50/50 dark:bg-secondary-950/20">
        <LoginButton />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background-50 dark:bg-secondary-950 text-secondary-900 dark:text-background-100 font-sans">
      {/* 1. Backdrop for mobile sidebar drawer */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-secondary-950/40 backdrop-blur-xs md:hidden transition-opacity duration-300"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* 2. Left Sidebar (Drawer on mobile, static on desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 md:w-80 shrink-0 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 3. Right Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-4 bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800/80 md:hidden shrink-0">
          <button
            onClick={toggleMobileSidebar}
            className="p-2 rounded-xl text-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-800 focus:outline-none cursor-pointer"
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Logo />
          <div className="w-10 h-10" /> {/* Spacer to center the logo */}
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-hidden relative flex flex-col min-w-0 bg-background-50 dark:bg-secondary-950">
          <ScrollArea className="flex-1 h-full w-full">
            {children}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
