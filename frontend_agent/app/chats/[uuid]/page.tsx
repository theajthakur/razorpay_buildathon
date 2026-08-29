"use client";

import React, { use } from "react";
import ChatWindow from "@/components/chat/ChatWindow";

interface ChatPageProps {
  params: Promise<{
    uuid: string;
  }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const resolvedParams = use(params);
  const uuid = resolvedParams.uuid;

  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden">
      <ChatWindow conversationId={uuid} />
    </div>
  );
}
